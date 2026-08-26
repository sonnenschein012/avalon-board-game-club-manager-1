import {
  collection,
  doc,
  getDocs,
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
import { formatMemberPhone } from '../../domain/interviews/memberRegistration';
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
): Promise<string> {
  const profileRef = doc(collection(db, 'interviewerProfiles'));
  const participantRef = doc(db, 'interviewRoundInterviewers', `${roundId}__${profileRef.id}`);
  const normalizedEmail = draft.email?.trim().toLowerCase() || null;
  const normalizedPhone = draft.phone ? formatMemberPhone(draft.phone) || null : null;
  const batch = writeBatch(db);
  const profile: Omit<InterviewerProfile, 'id' | 'createdAt' | 'updatedAt'> = { name: draft.name.trim(), email: normalizedEmail, phone: normalizedPhone, active: true };
  batch.set(profileRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(participantRef, {
    roundId, interviewerId: profileRef.id, displayName: draft.name.trim(), email: normalizedEmail, phone: normalizedPhone, availability: [], active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return profileRef.id;
}

export async function updateRoundInterviewerAvailability(participantId: string, availability: string[]): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participantId), { availability: [...new Set(availability)].sort(), updatedAt: serverTimestamp() });
}

export async function updateScheduleInterviewerAvailability(participantId: string, availability: string[]): Promise<void> {
  await updateDoc(doc(db, 'interviewScheduleInterviewers', participantId), { availability: [...new Set(availability)].sort(), updatedAt: serverTimestamp() });
}

export async function updateInterviewerPhone(participant: InterviewRoundInterviewer, phone: string): Promise<void> {
  const normalizedPhone = formatMemberPhone(phone) || null;
  const scheduleParticipants = await getDocs(query(collection(db, 'interviewScheduleInterviewers'), where('interviewerId', '==', participant.interviewerId)));
  if (scheduleParticipants.size > 490) throw new Error('연락처를 한 번에 반영할 수 있는 일정 수를 초과했습니다.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewerProfiles', participant.interviewerId), { phone: normalizedPhone, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'interviewRoundInterviewers', `${participant.roundId}__${participant.interviewerId}`), { phone: normalizedPhone, updatedAt: serverTimestamp() });
  scheduleParticipants.docs.forEach(snapshot => batch.update(snapshot.ref, { phone: normalizedPhone, updatedAt: serverTimestamp() }));
  await batch.commit();
}

export async function updateInterviewerProfile(
  participant: InterviewRoundInterviewer,
  draft: RoundInterviewerDraft,
): Promise<void> {
  const displayName = draft.name.trim();
  const email = draft.email?.trim().toLowerCase() || null;
  const phone = draft.phone ? formatMemberPhone(draft.phone) || null : null;
  const scheduleParticipants = await getDocs(query(collection(db, 'interviewScheduleInterviewers'), where('interviewerId', '==', participant.interviewerId)));
  if (scheduleParticipants.size > 490) throw new Error('면접관 정보를 한 번에 반영할 수 있는 일정 수를 초과했습니다.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewerProfiles', participant.interviewerId), { name: displayName, email, phone, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'interviewRoundInterviewers', `${participant.roundId}__${participant.interviewerId}`), { displayName, email, phone, updatedAt: serverTimestamp() });
  scheduleParticipants.docs.forEach(snapshot => batch.update(snapshot.ref, { displayName, email, phone, updatedAt: serverTimestamp() }));
  await batch.commit();
}

export async function removeRoundInterviewer(participant: InterviewRoundInterviewer): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participant.id), { active: false, updatedAt: serverTimestamp() });
}

export async function removeScheduleInterviewer(participantId: string): Promise<void> {
  await updateDoc(doc(db, 'interviewScheduleInterviewers', participantId), {
    active: false,
    availability: [],
    updatedAt: serverTimestamp(),
  });
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
