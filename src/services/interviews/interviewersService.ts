import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { collectAuditChanges } from '../../domain/audit/auditEvent';
import { assertExpectedUpdatedAt } from '../../domain/interviews/revisionConflict';
import { formatMemberPhone } from '../../domain/members/memberIdentity';
import { db } from '../../lib/firebase';
import { addAuditEventToBatch, addAuditEventToTransaction } from '../auditService';
import type {
  InterviewChangeRequest,
  InterviewRoundInterviewer,
  InterviewScheduleInterviewer,
  InterviewerProfile,
} from '../../types';
import type { RoundInterviewerDraft } from './models';
import { actorEmail, mapSnapshot } from './shared';

const INTERVIEWER_AUDIT_FIELDS = [
  { key: 'name', label: '이름' },
  { key: 'email', label: '이메일' },
  { key: 'phone', label: '전화번호' },
] as const;

export function subscribeRoundInterviewers(
  roundId: string,
  onData: (items: InterviewRoundInterviewer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewRoundInterviewers'), where('roundId', '==', roundId)), snapshot => {
    onData(mapSnapshot<InterviewRoundInterviewer>(snapshot).sort((left, right) => left.displayName.localeCompare(right.displayName)));
  }, onError);
}

export function subscribeRoundScheduleInterviewers(
  roundId: string,
  onData: (items: InterviewScheduleInterviewer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewScheduleInterviewers'), where('roundId', '==', roundId)), snapshot => {
    onData(mapSnapshot<InterviewScheduleInterviewer>(snapshot));
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
  addAuditEventToBatch(batch, {
    category: 'interview',
    action: 'interview.interviewer_added',
    targetId: profileRef.id,
    targetLabel: draft.name.trim(),
    ...(normalizedEmail ?? normalizedPhone ? { detail: normalizedEmail ?? normalizedPhone ?? '' } : {}),
  });
  await batch.commit();
  return profileRef.id;
}

async function updateInterviewerAvailability(collectionName: 'interviewRoundInterviewers' | 'interviewScheduleInterviewers', participantId: string, availability: string[], expectedUpdatedAtMillis?: number) {
  const participantRef = doc(db, collectionName, participantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(participantRef);
    if (!snapshot.exists()) throw new Error('면접관 정보를 찾을 수 없습니다.');
    const participant = snapshot.data() as InterviewRoundInterviewer | InterviewScheduleInterviewer;
    assertExpectedUpdatedAt(participant.updatedAt, expectedUpdatedAtMillis, '면접관 가능시간');
    const previousAvailability = [...new Set(participant.availability)].sort();
    const nextAvailability = [...new Set(availability)].sort();
    if (previousAvailability.join('|') === nextAvailability.join('|')) return;
    transaction.update(participantRef, { availability: nextAvailability, updatedAt: serverTimestamp() });
    addAuditEventToTransaction(transaction, {
      category: 'interview',
      action: 'interview.interviewer_availability_updated',
      targetId: participant.interviewerId,
      targetLabel: participant.displayName,
      changes: [{
        field: 'availability',
        label: '가능시간',
        before: previousAvailability.join(', ') || '없음',
        after: nextAvailability.join(', ') || '없음',
      }],
      detail: collectionName === 'interviewScheduleInterviewers' ? '개별 면접 일정' : '면접 회차 기본값',
    });
  });
}

export async function updateRoundInterviewerAvailability(participantId: string, availability: string[], expectedUpdatedAtMillis?: number): Promise<void> {
  await updateInterviewerAvailability('interviewRoundInterviewers', participantId, availability, expectedUpdatedAtMillis);
}

export async function updateScheduleInterviewerAvailability(participantId: string, availability: string[], expectedUpdatedAtMillis?: number): Promise<void> {
  await updateInterviewerAvailability('interviewScheduleInterviewers', participantId, availability, expectedUpdatedAtMillis);
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
  const changes = collectAuditChanges(
    { name: participant.displayName, email: participant.email, phone: participant.phone ?? null },
    { name: displayName, email, phone },
    INTERVIEWER_AUDIT_FIELDS,
  );
  if (changes.length > 0) {
    addAuditEventToBatch(batch, {
      category: 'interview',
      action: 'interview.interviewer_updated',
      targetId: participant.interviewerId,
      targetLabel: displayName,
      changes,
      detail: `연결된 일정 ${scheduleParticipants.size}곳에 함께 반영`,
    });
  }
  await batch.commit();
}

export async function removeRoundInterviewer(participant: InterviewRoundInterviewer): Promise<void> {
  const scheduleParticipants = await getDocs(query(collection(db, 'interviewScheduleInterviewers'), where('roundId', '==', participant.roundId)));
  const matchingParticipants = scheduleParticipants.docs.filter(snapshot => snapshot.data().interviewerId === participant.interviewerId);
  if (matchingParticipants.length > 490) throw new Error('면접관을 한 번에 제외할 수 있는 일정 수를 초과했습니다.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewRoundInterviewers', participant.id), { active: false, updatedAt: serverTimestamp() });
  matchingParticipants.forEach(snapshot => batch.update(snapshot.ref, { active: false, updatedAt: serverTimestamp() }));
  addAuditEventToBatch(batch, {
    category: 'interview',
    action: 'interview.interviewer_removed',
    targetId: participant.interviewerId,
    targetLabel: participant.displayName,
    detail: `회차 명부 및 연결된 일정 ${matchingParticipants.length}곳에서 제외`,
  });
  await batch.commit();
}

export async function reactivateRoundInterviewer(participant: InterviewRoundInterviewer): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewerProfiles', participant.interviewerId), { active: true, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'interviewRoundInterviewers', participant.id), { active: true, updatedAt: serverTimestamp() });
  addAuditEventToBatch(batch, {
    category: 'interview',
    action: 'interview.interviewer_reactivated',
    targetId: participant.interviewerId,
    targetLabel: participant.displayName,
  });
  await batch.commit();
}

export async function removeScheduleInterviewer(participantId: string): Promise<void> {
  const participantRef = doc(db, 'interviewScheduleInterviewers', participantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(participantRef);
    if (!snapshot.exists()) throw new Error('면접관 정보를 찾을 수 없습니다.');
    const participant = snapshot.data() as InterviewScheduleInterviewer;
    const scheduleSnapshot = await transaction.get(doc(db, 'interviewSchedules', participant.scheduleId));
    transaction.update(participantRef, {
      active: false,
      availability: [],
      updatedAt: serverTimestamp(),
    });
    addAuditEventToTransaction(transaction, {
      category: 'interview',
      action: 'interview.interviewer_removed',
      targetId: participant.interviewerId,
      targetLabel: participant.displayName,
      detail: `${String(scheduleSnapshot.data()?.name ?? '개별 면접 일정')}에서 제외`,
    });
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
  const requestRef = doc(db, 'interviewChangeRequests', requestId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new Error('일정 변경 요청을 찾을 수 없습니다.');
    const request = snapshot.data() as InterviewChangeRequest;
    transaction.update(requestRef, {
      status, resolvedAt: serverTimestamp(), resolvedBy: actorEmail(),
    });
    transaction.update(doc(db, 'interviewAccess', requestId), { changeRequestStatus: status });
    addAuditEventToTransaction(transaction, {
      category: 'interview',
      action: status === 'resolved' ? 'interview.change_request_resolved' : 'interview.change_request_dismissed',
      targetId: request.applicantId,
      targetLabel: request.applicantName,
      detail: request.reason,
    });
  });
}
