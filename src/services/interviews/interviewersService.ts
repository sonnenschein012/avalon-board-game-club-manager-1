import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { InterviewChangeRequest, InterviewRoundInterviewer, InterviewerProfile } from '../../types';
import type { RoundInterviewerDraft } from './models';
import { actorEmail, mapSnapshot } from './shared';

export function subscribeRoundInterviewers(
  roundId: string,
  onData: (items: InterviewRoundInterviewer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewRoundInterviewers'), where('roundId', '==', roundId)), snapshot => {
    onData(mapSnapshot<InterviewRoundInterviewer>(snapshot).sort((left, right) => left.displayName.localeCompare(right.displayName)));
  }, onError);
}

export async function addRoundInterviewer(
  roundId: string,
  draft: RoundInterviewerDraft,
  scheduleId: string | null = null,
): Promise<string> {
  const profileRef = doc(collection(db, 'interviewerProfiles'));
  const participantRef = doc(db, 'interviewRoundInterviewers', `${roundId}__${profileRef.id}`);
  const normalizedEmail = draft.email?.trim().toLowerCase() || null;
  const batch = writeBatch(db);
  const profile: Omit<InterviewerProfile, 'id' | 'createdAt' | 'updatedAt'> = { name: draft.name.trim(), email: normalizedEmail, active: true };
  batch.set(profileRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(participantRef, {
    roundId, interviewerId: profileRef.id, displayName: draft.name.trim(), email: normalizedEmail, availability: [], active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  if (scheduleId) {
    // Existing schedules own a separate availability roster. Add the new
    // interviewer to the currently managed one with an empty availability.
    batch.set(doc(db, 'interviewScheduleInterviewers', `${scheduleId}__${profileRef.id}`), {
      roundId, scheduleId, interviewerId: profileRef.id, displayName: draft.name.trim(), email: normalizedEmail, availability: [], active: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return profileRef.id;
}

export async function updateRoundInterviewerAvailability(participantId: string, availability: string[]): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participantId), { availability: [...new Set(availability)].sort(), updatedAt: serverTimestamp() });
}

export async function updateScheduleInterviewerAvailability(participantId: string, availability: string[]): Promise<void> {
  await updateDoc(doc(db, 'interviewScheduleInterviewers', participantId), { availability: [...new Set(availability)].sort(), updatedAt: serverTimestamp() });
}

export async function removeRoundInterviewer(participant: InterviewRoundInterviewer): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participant.id), { active: false, updatedAt: serverTimestamp() });
}

export async function removeScheduleInterviewer(participantId: string): Promise<void> {
  await updateDoc(doc(db, 'interviewScheduleInterviewers', participantId), { active: false, updatedAt: serverTimestamp() });
}

export function subscribeInterviewChangeRequests(
  roundId: string,
  onData: (items: InterviewChangeRequest[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewChangeRequests'), where('roundId', '==', roundId)), snapshot => {
    onData(mapSnapshot<InterviewChangeRequest>(snapshot).sort((left, right) => right.requestedAt.toMillis() - left.requestedAt.toMillis()));
  }, onError);
}

export async function resolveInterviewChangeRequest(requestId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewChangeRequests', requestId), {
    status, resolvedAt: serverTimestamp(), resolvedBy: actorEmail(),
  });
  batch.update(doc(db, 'interviewAccess', requestId), { changeRequestStatus: status });
  await batch.commit();
}
