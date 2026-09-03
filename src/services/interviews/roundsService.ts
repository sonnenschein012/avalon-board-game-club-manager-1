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
  await batch.commit();
  return roundRef.id;
}

/** Updates only fields owned by the round settings screen. Schedule fields and
 * revisions are intentionally left untouched. */
export async function updateInterviewRoundSettings(roundId: string, draft: InterviewRoundDraft): Promise<void> {
  if (!isSingleDocumentId(roundId)) throw new Error('올바른 면접 회차 ID가 아닙니다.');
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
  await commitBatchesInChunks(db, [{ type: 'delete', ref: roundRef }]);

  return { deletedDocuments: publicRefs.length + remainingRefs.length + 1 };
}
