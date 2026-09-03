import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { normalizeApplicantNumber } from '../../domain/interviews/applicantMerge';
import { isActiveInterviewApplicant } from '../../domain/interviews/interviewPolicy';
import { getApplicantAssignmentRevision } from '../../domain/interviews/interviewTransitions';
import { assertExpectedUpdatedAt, timestampMillis } from '../../domain/interviews/revisionConflict';
import { db } from '../../lib/firebase';
import type { InterviewAccess, InterviewApplicant } from '../../types';
import {
  generateInterviewToken,
  type ApplicantDraft,
  type ApplicantMergeCommitItem,
} from './models';
import { mapSnapshot } from './shared';

function getApplicantKeyId(roundId: string, applicantNumber: string) {
  return [roundId, normalizeApplicantNumber(applicantNumber)].map(encodeURIComponent).join('__');
}

export function subscribeInterviewApplicants(
  roundId: string,
  onData: (applicants: InterviewApplicant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewApplicants'), where('roundId', '==', roundId)),
    snapshot => onData(mapSnapshot<InterviewApplicant>(snapshot).sort((a, b) => (a.sourceRowNumber ?? Number.MAX_SAFE_INTEGER) - (b.sourceRowNumber ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))),
    onError,
  );
}

export function subscribeInterviewAccess(
  roundId: string,
  onData: (access: InterviewAccess[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewAccess'), where('roundId', '==', roundId)),
    snapshot => onData(mapSnapshot<InterviewAccess>(snapshot).filter(item => !item.supersededBy)),
    onError,
  );
}

export function subscribeAllInterviewApplicants(
  onData: (applicants: InterviewApplicant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'interviewApplicants'), snapshot => onData(mapSnapshot<InterviewApplicant>(snapshot)), onError);
}

export function subscribeAllInterviewAccess(
  onData: (access: InterviewAccess[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'interviewAccess'), snapshot => onData(mapSnapshot<InterviewAccess>(snapshot).filter(item => !item.supersededBy)), onError);
}

export async function markInterviewMessageSent(
  applicantId: string,
  kind: 'availabilityMessage' | 'reminderMessage' | 'confirmationMessage',
  markedSent = true,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    const previous = applicant[kind] as InterviewApplicant[typeof kind] | undefined;
    const currentAssignment = applicant.assignment;
    if (kind === 'confirmationMessage' && markedSent) {
      if (!isActiveInterviewApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자에게는 확정 안내를 기록할 수 없습니다.');
      if (!currentAssignment) throw new Error('현재 면접 배정이 없어 확정 안내를 기록할 수 없습니다.');
    }

    const revision = getApplicantAssignmentRevision(applicant);
    const messagePatch = markedSent ? {
      [`${kind}.firstMarkedSentAt`]: previous?.firstMarkedSentAt ?? serverTimestamp(),
      [`${kind}.lastMarkedSentAt`]: serverTimestamp(),
      ...(kind === 'confirmationMessage' ? { [`${kind}.assignmentRevision`]: revision } : {}),
    } : {
      [`${kind}.firstMarkedSentAt`]: null,
      [`${kind}.lastMarkedSentAt`]: null,
      ...(kind === 'confirmationMessage' ? { [`${kind}.assignmentRevision`]: 0 } : {}),
    };
    transaction.update(applicantRef, {
      ...messagePatch,
      ...(kind === 'confirmationMessage' && currentAssignment
        ? { 'assignment.status': markedSent ? 'confirmed' : 'scheduled' }
        : {}),
      updatedAt: serverTimestamp(),
    });
    if (kind === 'confirmationMessage' && currentAssignment) {
      transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
        'assignmentSummary.status': markedSent ? 'confirmed' : 'scheduled',
      });
    }
  });
}

export async function createInterviewApplicant(roundId: string, draft: ApplicantDraft): Promise<string> {
  const applicantRef = doc(collection(db, 'interviewApplicants'));
  const keyRef = doc(db, 'interviewApplicantKeys', getApplicantKeyId(roundId, draft.applicantNumber));
  const token = generateInterviewToken();
  await runTransaction(db, async transaction => {
    const keySnapshot = await transaction.get(keyRef);
    if (keySnapshot.exists()) throw new Error('이미 등록된 지원번호입니다.');
    transaction.set(keyRef, { roundId, applicantId: applicantRef.id, applicantNumber: normalizeApplicantNumber(draft.applicantNumber), createdAt: serverTimestamp() });
    transaction.set(applicantRef, {
      roundId,
      scheduleId: null,
      scheduleAssignedAt: null,
      scheduleAssignmentRevision: 0,
      applicantNumber: draft.applicantNumber.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      applicationData: draft.applicationData,
      accessToken: token,
      sourceRowNumber: null,
      source: 'manual',
      lifecycle: 'active',
      applicationStatus: 'active',
      withdrawnAt: null,
      withdrawnBy: null,
      archivedAt: null,
      archivedReason: null,
      availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
      reminderMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
      confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
      assignment: null,
      previousAssignment: null,
      assignmentRevision: 0,
      interviewStatus: 'scheduled',
      actionNeededReason: null,
      overallRating: null,
      interviewCompletedAt: null,
      interviewCompletedBy: null,
      selectionStatus: 'pending',
      selectionDecidedAt: null,
      selectionDecidedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(db, 'interviewAccess', token), {
      roundId,
      scheduleId: null,
      scheduleAssignmentRevision: 0,
      applicantId: applicantRef.id,
      displayName: draft.name.trim(),
      availability: [],
      submittedAt: null,
      updatedAt: null,
      responseUpdatedAt: null,
      firstAccessedAt: null,
      tokenRevision: 1,
      supersededBy: null,
      supersededAt: null,
      reissuedFrom: null,
      active: true,
      assignmentSummary: null,
      changeRequestStatus: 'none',
      createdAt: serverTimestamp(),
    });
  });
  return applicantRef.id;
}

export async function updateInterviewApplicant(applicant: InterviewApplicant, draft: ApplicantDraft): Promise<void> {
  const oldKeyRef = doc(db, 'interviewApplicantKeys', getApplicantKeyId(applicant.roundId, applicant.applicantNumber));
  const newKeyRef = doc(db, 'interviewApplicantKeys', getApplicantKeyId(applicant.roundId, draft.applicantNumber));
  const applicantRef = doc(db, 'interviewApplicants', applicant.id);
  await runTransaction(db, async transaction => {
    const [newKeySnapshot, currentApplicantSnapshot] = await Promise.all([
      transaction.get(newKeyRef),
      transaction.get(applicantRef),
    ]);
    if (!currentApplicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    assertExpectedUpdatedAt(currentApplicantSnapshot.data().updatedAt, timestampMillis(applicant.updatedAt) ?? undefined, '지원자 정보');
    if (newKeySnapshot.exists() && newKeySnapshot.data().applicantId !== applicant.id) throw new Error('이미 등록된 지원번호입니다.');
    if (oldKeyRef.path !== newKeyRef.path) transaction.delete(oldKeyRef);
    transaction.set(newKeyRef, { roundId: applicant.roundId, applicantId: applicant.id, applicantNumber: normalizeApplicantNumber(draft.applicantNumber), updatedAt: serverTimestamp() });
    transaction.update(applicantRef, {
      applicantNumber: draft.applicantNumber.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      applicationData: draft.applicationData,
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), { displayName: draft.name.trim() });
  });
}

export async function setInterviewApplicantArchived(applicant: InterviewApplicant, archived: boolean, reason = ''): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewApplicants', applicant.id), {
    lifecycle: archived ? 'archived' : 'active',
    archivedAt: archived ? serverTimestamp() : null,
    archivedReason: archived ? reason.trim() || '운영진 보관 처리' : null,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'interviewAccess', applicant.accessToken), {
    active: !archived && (applicant.applicationStatus ?? 'active') === 'active',
  });
  await batch.commit();
}

export async function mergeInterviewApplicants(roundId: string, items: ApplicantMergeCommitItem[]): Promise<{ created: number; updated: number }> {
  if (items.length === 0) return { created: 0, updated: 0 };
  await runTransaction(db, async transaction => {
    const keyRefs = items.map(item => doc(db, 'interviewApplicantKeys', getApplicantKeyId(roundId, item.applicantNumber)));
    const keySnapshots = await Promise.all(keyRefs.map(ref => transaction.get(ref)));
    const updateSnapshots = await Promise.all(items.map(item => item.action === 'update' && item.existingId
      ? transaction.get(doc(db, 'interviewApplicants', item.existingId))
      : Promise.resolve(null)));
    items.forEach((item, index) => {
      const keySnapshot = keySnapshots[index];
      if (item.action === 'create' && keySnapshot?.exists()) throw new Error(`${item.applicantNumber} 지원번호가 다른 작업에서 먼저 등록되었습니다.`);
      if (item.action === 'update' && !item.existingId) throw new Error('업데이트할 지원자 ID가 없습니다.');
    });
    items.forEach((item, index) => {
      if (item.action === 'update') {
        const applicantRef = doc(db, 'interviewApplicants', item.existingId!);
        transaction.update(applicantRef, {
          name: item.name.trim(), phone: item.phone.trim(), applicationData: item.applicationData,
          sourceRowNumber: item.sourceRowNumber, source: 'csv', updatedAt: serverTimestamp(),
        });
        const existingApplicant = updateSnapshots[index]?.data() as InterviewApplicant | undefined;
        if (existingApplicant?.accessToken) transaction.update(doc(db, 'interviewAccess', existingApplicant.accessToken), { displayName: item.name.trim() });
        const existing = keySnapshots[index]?.data();
        if (!existing) transaction.set(keyRefs[index]!, { roundId, applicantId: item.existingId, applicantNumber: normalizeApplicantNumber(item.applicantNumber), createdAt: serverTimestamp() });
        return;
      }
      const applicantRef = doc(collection(db, 'interviewApplicants'));
      const token = generateInterviewToken();
      transaction.set(keyRefs[index]!, { roundId, applicantId: applicantRef.id, applicantNumber: normalizeApplicantNumber(item.applicantNumber), createdAt: serverTimestamp() });
      transaction.set(applicantRef, {
        roundId, scheduleId: null, scheduleAssignedAt: null, scheduleAssignmentRevision: 0,
        applicantNumber: item.applicantNumber.trim(), name: item.name.trim(), phone: item.phone.trim(),
        applicationData: item.applicationData, accessToken: token, sourceRowNumber: item.sourceRowNumber,
        source: 'csv', lifecycle: 'active', applicationStatus: 'active', withdrawnAt: null, withdrawnBy: null,
        archivedAt: null, archivedReason: null,
        availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        reminderMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
        assignment: null, previousAssignment: null, assignmentRevision: 0,
        interviewStatus: 'scheduled', actionNeededReason: null, overallRating: null,
        interviewCompletedAt: null, interviewCompletedBy: null,
        selectionStatus: 'pending', selectionDecidedAt: null, selectionDecidedBy: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      transaction.set(doc(db, 'interviewAccess', token), {
        roundId, scheduleId: null, scheduleAssignmentRevision: 0,
        applicantId: applicantRef.id, displayName: item.name.trim(), availability: [], submittedAt: null,
        updatedAt: null, responseUpdatedAt: null, firstAccessedAt: null,
        tokenRevision: 1, supersededBy: null, supersededAt: null, reissuedFrom: null,
        active: true, createdAt: serverTimestamp(),
        assignmentSummary: null, changeRequestStatus: 'none',
      });
    });
  });
  return {
    created: items.filter(item => item.action === 'create').length,
    updated: items.filter(item => item.action === 'update').length,
  };
}
