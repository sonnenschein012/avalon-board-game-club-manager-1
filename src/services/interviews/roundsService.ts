import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { commitBatchesInChunks } from '../../lib/chunkBatch';
import { isSingleDocumentId } from '../../domain/shared/documentId';
import type {
  InterviewAssignmentEvent,
  InterviewChangeRequest,
  InterviewNote,
  InterviewRecordEvent,
  InterviewRound,
} from '../../types';
import type { InterviewRoundDraft, InterviewRoundExportRecords } from './models';
import { adminRoundData, mapSnapshot, publicRoundData } from './shared';
import { addAuditEventToBatch, createAuditEventOperation } from '../auditService';

const MESSAGE_TEMPLATE_AUDIT_FIELDS = [
  { key: 'availability', label: '가능시간 조사 문자' },
  { key: 'reminder', label: '응답 독촉 문자' },
  { key: 'confirmation', label: '면접 확정 문자' },
  { key: 'reschedule', label: '일정 변경 문자' },
  { key: 'selected', label: '선발 안내 문자' },
  { key: 'rejected', label: '미선발 안내 문자' },
] as const;

/** Fetches immutable and note records not kept in the live round listener. */
export async function getInterviewRoundExportRecords(roundId: string): Promise<InterviewRoundExportRecords> {
  const [notes, assignmentEvents, recordEvents, changeRequests] = await Promise.all([
    getDocs(query(collection(db, 'interviewNotes'), where('roundId', '==', roundId))),
    getDocs(query(collection(db, 'interviewAssignmentEvents'), where('roundId', '==', roundId))),
    getDocs(query(collection(db, 'interviewRecordEvents'), where('roundId', '==', roundId))),
    getDocs(query(collection(db, 'interviewChangeRequests'), where('roundId', '==', roundId))),
  ]);
  return {
    notes: mapSnapshot<InterviewNote>(notes),
    assignmentEvents: mapSnapshot<InterviewAssignmentEvent>(assignmentEvents),
    recordEvents: mapSnapshot<InterviewRecordEvent>(recordEvents),
    changeRequests: mapSnapshot<InterviewChangeRequest>(changeRequests),
  };
}

export function subscribeInterviewRounds(
  onData: (rounds: InterviewRound[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewRounds'), orderBy('createdAt', 'desc')),
    snapshot => onData(mapSnapshot<InterviewRound>(snapshot)),
    onError,
  );
}

export function subscribeInterviewRound(
  roundId: string,
  onData: (round: InterviewRound | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (!isSingleDocumentId(roundId)) {
    onData(null);
    return () => {};
  }
  return onSnapshot(doc(db, 'interviewRounds', roundId), snapshot => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewRound) : null);
  }, onError);
}

export async function createInterviewRound(draft: InterviewRoundDraft): Promise<string> {
  const roundRef = doc(collection(db, 'interviewRounds'));
  const publicRef = doc(db, 'interviewPublicRounds', roundRef.id);
  const batch = writeBatch(db);
  batch.set(roundRef, { ...adminRoundData(draft, 1), createdAt: serverTimestamp() });
  batch.set(publicRef, publicRoundData(draft, 1));
  addAuditEventToBatch(batch, {
    category: 'interview',
    action: 'interview.round_created',
    targetId: roundRef.id,
    targetLabel: draft.name.trim(),
    detail: `${draft.interviewDates.length}일 · 면접 질문 ${draft.interviewQuestions.length}개`,
  });
  await batch.commit();
  return roundRef.id;
}

/** Updates only fields owned by the round settings screen. Schedule fields and
 * revisions are intentionally left untouched. */
export async function updateInterviewRoundSettings(roundId: string, draft: InterviewRoundDraft): Promise<void> {
  if (!isSingleDocumentId(roundId)) throw new Error('올바른 면접 회차 ID가 아닙니다.');
  const currentSnapshot = await getDoc(doc(db, 'interviewRounds', roundId));
  if (!currentSnapshot.exists()) throw new Error('수정할 면접 회차를 찾을 수 없습니다.');
  const current = currentSnapshot.data() as InterviewRound;
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewRounds', roundId), {
    name: draft.name.trim(),
    instructions: draft.instructions,
    messageTemplates: draft.messageTemplates,
    interviewQuestions: draft.interviewQuestions,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'interviewPublicRounds', roundId), {
    name: draft.name.trim(),
    instructions: draft.instructions,
    updatedAt: serverTimestamp(),
  });
  const changes = [
    { field: 'name', label: '회차명', before: current.name, after: draft.name.trim() },
    {
      field: 'interviewQuestions',
      label: '면접 질문',
      before: (current.interviewQuestions ?? []).map(item => item.text).join(' / ') || '없음',
      after: draft.interviewQuestions.map(item => item.text).join(' / ') || '없음',
    },
    { field: 'instructions', label: '지원자 안내문', before: current.instructions || '없음', after: draft.instructions || '없음' },
    ...MESSAGE_TEMPLATE_AUDIT_FIELDS.map(({ key, label }) => ({
      field: `messageTemplates.${key}`,
      label,
      before: current.messageTemplates?.[key] || '없음',
      after: draft.messageTemplates[key] || '없음',
    })),
  ].filter(change => change.before !== change.after);
  if (changes.length > 0) {
    addAuditEventToBatch(batch, {
      category: 'interview',
      action: 'interview.round_updated',
      targetId: roundId,
      targetLabel: draft.name.trim(),
      changes,
      detail: '회차 공통 설정과 문자 템플릿을 저장했습니다.',
    });
  }
  await batch.commit();
}

export async function hasInterviewRoundNotes(roundId: string): Promise<boolean> {
  if (!isSingleDocumentId(roundId)) return false;
  const snapshot = await getDocs(query(
    collection(db, 'interviewNotes'),
    where('roundId', '==', roundId),
    limit(1),
  ));
  return !snapshot.empty;
}

const ROUND_SCOPED_COLLECTIONS = [
  'interviewSchedules',
  'interviewApplicants',
  'interviewAccess',
  'interviewApplicantKeys',
  'interviewRoundInterviewers',
  'interviewScheduleInterviewers',
  'interviewAssignmentLocks',
  'interviewAssignmentEvents',
  'interviewNotes',
  'interviewRecordEvents',
  'interviewChangeRequests',
] as const;

export interface InterviewRoundDeletionResult {
  deletedDocuments: number;
}

/**
 * Permanently removes a round and its private/public interview records.
 * Linked member documents are intentionally preserved because they may have
 * become normal club records after selection.
 */
export async function deleteInterviewRound(roundId: string): Promise<InterviewRoundDeletionResult> {
  if (!isSingleDocumentId(roundId)) throw new Error('올바르지 않은 면접 회차 ID입니다.');
  const roundRef = doc(db, 'interviewRounds', roundId);
  const roundSnapshot = await getDoc(roundRef);
  if (!roundSnapshot.exists()) throw new Error('삭제할 면접 회차를 찾을 수 없습니다.');

  const [scopedSnapshots, publicScheduleSnapshots] = await Promise.all([
    Promise.all(ROUND_SCOPED_COLLECTIONS.map(collectionName => (
      getDocs(query(collection(db, collectionName), where('roundId', '==', roundId)))
    ))),
    getDocs(query(collection(db, 'interviewPublicSchedules'), where('roundId', '==', roundId))),
  ]);

  const roundInterviewerIndex = ROUND_SCOPED_COLLECTIONS.indexOf('interviewRoundInterviewers');
  const scheduleInterviewerIndex = ROUND_SCOPED_COLLECTIONS.indexOf('interviewScheduleInterviewers');
  const interviewerIds = new Set<string>();
  [scopedSnapshots[roundInterviewerIndex], scopedSnapshots[scheduleInterviewerIndex]].forEach(snapshot => {
    snapshot?.docs.forEach(item => {
      const interviewerId = item.data().interviewerId;
      if (typeof interviewerId === 'string' && interviewerId) interviewerIds.add(interviewerId);
    });
  });
  // Interviewers are created inside a round. Names and contact details are
  // not reliable cross-round identity, so their generated profiles belong to
  // this round and are removed with it.
  const profileRefs = [...interviewerIds].map(interviewerId => doc(db, 'interviewerProfiles', interviewerId));

  const publicRefs: DocumentReference<DocumentData>[] = [
    doc(db, 'interviewPublicRounds', roundId),
    ...publicScheduleSnapshots.docs.map(item => item.ref),
    ...scopedSnapshots[ROUND_SCOPED_COLLECTIONS.indexOf('interviewAccess')]!.docs.map(item => item.ref),
  ];
  const publicPaths = new Set(publicRefs.map(ref => ref.path));
  const privateRefs = scopedSnapshots
    .flatMap(snapshot => snapshot.docs.map(item => item.ref))
    .filter(ref => !publicPaths.has(ref.path));
  const remainingRefs = [...privateRefs, ...profileRefs];

  // Public access is removed first. The root round disappears only after all
  // dependent records have been deleted successfully.
  await commitBatchesInChunks(db, publicRefs.map(ref => ({ type: 'delete' as const, ref })));
  await commitBatchesInChunks(db, remainingRefs.map(ref => ({ type: 'delete' as const, ref })));
  await commitBatchesInChunks(db, [
    { type: 'delete', ref: roundRef },
    createAuditEventOperation({
      category: 'interview',
      action: 'interview.round_deleted',
      targetId: roundId,
      targetLabel: String(roundSnapshot.data().name ?? '면접 회차'),
      count: publicRefs.length + remainingRefs.length + 1,
      detail: `회차와 관련 데이터 ${publicRefs.length + remainingRefs.length + 1}건을 삭제했습니다.`,
    }),
  ]);

  return { deletedDocuments: publicRefs.length + remainingRefs.length + 1 };
}
