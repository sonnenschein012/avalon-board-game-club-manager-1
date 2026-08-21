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
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
