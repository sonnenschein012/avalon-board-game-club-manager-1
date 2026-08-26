import {
  collection,
  doc,
  getDoc,
  getDocs,
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

export async function getInterviewRound(roundId: string): Promise<InterviewRound | null> {
  if (!isSingleDocumentId(roundId)) return null;
  const snapshot = await getDoc(doc(db, 'interviewRounds', roundId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewRound) : null;
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
  const profileUsage = await Promise.all([...interviewerIds].map(async interviewerId => ({
    interviewerId,
    participants: await getDocs(query(
      collection(db, 'interviewRoundInterviewers'),
      where('interviewerId', '==', interviewerId),
    )),
  })));
  const profileRefs = profileUsage
    .filter(item => item.participants.docs.every(participant => participant.data().roundId === roundId))
    .map(item => doc(db, 'interviewerProfiles', item.interviewerId));

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
