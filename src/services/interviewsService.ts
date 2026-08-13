import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAssignmentScheduleImpact } from '../domain/interviews/scheduling';
import type {
  InterviewAccess,
  InterviewApplicant,
  InterviewApplicationField,
  InterviewAssignment,
  InterviewPublicRound,
  InterviewRound,
  InterviewRoundStatus,
} from '../types';

export const INTERVIEW_LINK_ORIGIN = window.location.origin;

export interface InterviewRoundDraft {
  name: string;
  surveyOpensAt: Date;
  surveyClosesAt: Date;
  interviewDates: string[];
  dayStartTime: string;
  dayEndTime: string;
  availabilitySlotMinutes: number;
  assignmentSlotMinutes: number;
  status: InterviewRoundStatus;
  instructions: string;
  messageTemplates: InterviewRound['messageTemplates'];
  allowedSlots: string[];
}

export interface ApplicantImportRow {
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  sourceRowNumber: number;
}

export interface InterviewApplicantWithAccess extends InterviewApplicant {
  access: InterviewAccess | null;
  link: string;
}

type WriteOperation = {
  type: 'set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: DocumentData;
};

function mapSnapshot<T extends { id: string }>(snapshot: { docs: Array<{ id: string; data(): DocumentData }> }): T[] {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T));
}

function sharedRoundData(draft: InterviewRoundDraft) {
  return {
    name: draft.name,
    surveyOpensAt: Timestamp.fromDate(draft.surveyOpensAt),
    surveyClosesAt: Timestamp.fromDate(draft.surveyClosesAt),
    interviewDates: draft.interviewDates,
    dayStartTime: draft.dayStartTime,
    dayEndTime: draft.dayEndTime,
    availabilitySlotMinutes: draft.availabilitySlotMinutes,
    status: draft.status,
    instructions: draft.instructions,
    allowedSlots: draft.allowedSlots,
    schemaVersion: 1 as const,
  };
}

function publicRoundData(draft: InterviewRoundDraft): Omit<InterviewPublicRound, 'id' | 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } {
  return { ...sharedRoundData(draft), active: true, updatedAt: serverTimestamp() };
}

function adminRoundData(draft: InterviewRoundDraft) {
  return {
    ...sharedRoundData(draft),
    assignmentSlotMinutes: draft.assignmentSlotMinutes,
    messageTemplates: draft.messageTemplates,
    updatedAt: serverTimestamp(),
  };
}

async function commitOperations(operations: WriteOperation[], chunkSize = 400) {
  for (let offset = 0; offset < operations.length; offset += chunkSize) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(offset, offset + chunkSize)) {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else if (operation.type === 'update' && operation.data) batch.update(operation.ref, operation.data);
      else if (operation.type === 'set' && operation.data) batch.set(operation.ref, operation.data);
    }
    await batch.commit();
  }
}

export function generateInterviewToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getInterviewLink(token: string): string {
  return new URL(`/interview/${encodeURIComponent(token)}`, INTERVIEW_LINK_ORIGIN).toString();
}

function getAssignmentLockId(roundId: string, assignment: Pick<InterviewAssignment, 'interviewerId' | 'slotId'>) {
  if (!assignment.slotId) throw new Error('면접 배정 슬롯 ID가 없습니다.');
  return [roundId, assignment.interviewerId, assignment.slotId].map(encodeURIComponent).join('__');
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

export function subscribeInterviewApplicants(
  roundId: string,
  onData: (applicants: InterviewApplicant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewApplicants'), where('roundId', '==', roundId)),
    snapshot => onData(mapSnapshot<InterviewApplicant>(snapshot).sort((a, b) => a.sourceRowNumber - b.sourceRowNumber)),
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
    snapshot => onData(mapSnapshot<InterviewAccess>(snapshot)),
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
  return onSnapshot(collection(db, 'interviewAccess'), snapshot => onData(mapSnapshot<InterviewAccess>(snapshot)), onError);
}

export async function getInterviewRound(roundId: string): Promise<InterviewRound | null> {
  const snapshot = await getDoc(doc(db, 'interviewRounds', roundId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewRound) : null;
}

export async function createInterviewRound(draft: InterviewRoundDraft): Promise<string> {
  const roundRef = doc(collection(db, 'interviewRounds'));
  const publicRef = doc(db, 'interviewPublicRounds', roundRef.id);
  const batch = writeBatch(db);
  batch.set(roundRef, { ...adminRoundData(draft), createdAt: serverTimestamp() });
  batch.set(publicRef, publicRoundData(draft));
  await batch.commit();
  return roundRef.id;
}

export async function importInterviewApplicants(roundId: string, rows: ApplicantImportRow[]): Promise<number> {
  const operations: WriteOperation[] = [];
  for (const row of rows) {
    const applicantRef = doc(collection(db, 'interviewApplicants'));
    const token = generateInterviewToken();
    operations.push({
      type: 'set',
      ref: applicantRef,
      data: {
        roundId,
        applicantNumber: row.applicantNumber,
        name: row.name,
        phone: row.phone,
        applicationData: row.applicationData,
        accessToken: token,
        sourceRowNumber: row.sourceRowNumber,
        availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        reminderMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
        assignment: null,
        assignmentRevision: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
    operations.push({
      type: 'set',
      ref: doc(db, 'interviewAccess', token),
      data: {
        roundId,
        applicantId: applicantRef.id,
        displayName: row.name,
        availability: [],
        submittedAt: null,
        updatedAt: null,
        responseUpdatedAt: null,
        active: true,
        createdAt: serverTimestamp(),
      },
    });
  }
  await commitOperations(operations);
  return rows.length;
}

export async function markInterviewMessageSent(
  applicantId: string,
  kind: 'availabilityMessage' | 'reminderMessage' | 'confirmationMessage',
  markedSent = true,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  const snapshot = await getDoc(applicantRef);
  if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
  const previous = snapshot.data()[kind] as InterviewApplicant[typeof kind] | undefined;
  const currentAssignment = snapshot.data().assignment as InterviewAssignment | null | undefined;
  const assignmentRevision = snapshot.data().assignmentRevision as number | undefined;
  if (!markedSent) {
    await updateDoc(applicantRef, {
      [`${kind}.firstMarkedSentAt`]: null,
      [`${kind}.lastMarkedSentAt`]: null,
      ...(kind === 'confirmationMessage' ? { [`${kind}.assignmentRevision`]: 0 } : {}),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(applicantRef, {
    [`${kind}.firstMarkedSentAt`]: previous?.firstMarkedSentAt ?? serverTimestamp(),
    [`${kind}.lastMarkedSentAt`]: serverTimestamp(),
    ...(kind === 'confirmationMessage'
      ? { [`${kind}.assignmentRevision`]: assignmentRevision ?? currentAssignment?.confirmationRevision ?? 0 }
      : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function saveInterviewAssignment(
  applicantId: string,
  assignment: InterviewAssignment | null,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const currentAssignment = applicant.assignment;
    const nextRevision = (applicant.assignmentRevision ?? currentAssignment?.confirmationRevision ?? 0) + 1;
    const nextAssignment = assignment ? { ...assignment, confirmationRevision: nextRevision } : null;

    let nextLockRef: DocumentReference | null = null;
    if (nextAssignment) {
      nextLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, nextAssignment));
      const lockSnapshot = await transaction.get(nextLockRef);
      if (lockSnapshot.exists() && lockSnapshot.data().applicantId !== applicantId) {
        throw new Error('같은 면접관에게 이미 배정된 시간입니다.');
      }
    }

    if (currentAssignment?.slotId) {
      const currentLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, currentAssignment));
      if (!nextLockRef || currentLockRef.path !== nextLockRef.path) transaction.delete(currentLockRef);
    }
    if (nextLockRef && nextAssignment) {
      transaction.set(nextLockRef, {
        roundId: applicant.roundId,
        applicantId,
        interviewerId: nextAssignment.interviewerId,
        slotId: nextAssignment.slotId,
        startsAt: nextAssignment.startsAt,
        durationMinutes: nextAssignment.durationMinutes,
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(applicantRef, {
      assignment: nextAssignment,
      assignmentRevision: nextRevision,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function applyInterviewScheduleChange(
  roundId: string,
  draft: InterviewRoundDraft,
  accessRecordIds: string[],
  applicantRecordIds: string[],
): Promise<{ cleanedResponseCount: number; clearedAssignmentCount: number }> {
  const allowed = new Set(draft.allowedSlots);
  if (accessRecordIds.length + applicantRecordIds.length > 498) {
    throw new Error('한 번에 변경할 수 있는 면접 데이터 수(498건)를 초과했습니다.');
  }

  return runTransaction(db, async transaction => {
    // Transaction reads are retried if a public submission races this save,
    // preventing the cleanup from replacing a newer availability response.
    const accessRefs = accessRecordIds.map(id => doc(db, 'interviewAccess', id));
    const applicantRefs = applicantRecordIds.map(id => doc(db, 'interviewApplicants', id));
    const [accessSnapshots, applicantSnapshots] = await Promise.all([
      Promise.all(accessRefs.map(ref => transaction.get(ref))),
      Promise.all(applicantRefs.map(ref => transaction.get(ref))),
    ]);
    const affected = accessSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const data = snapshot.data() as InterviewAccess;
      if (data.roundId !== roundId) return [];
      const nextAvailability = data.availability.filter(slot => allowed.has(slot));
      return nextAvailability.length === data.availability.length
        ? []
        : [{ ref: snapshot.ref, availability: nextAvailability }];
    });
    const latestApplicants = applicantSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const data = snapshot.data() as InterviewApplicant;
      return data.roundId === roundId
        ? [{ applicantId: snapshot.id, assignment: data.assignment, ref: snapshot.ref }]
        : [];
    });
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      latestApplicants,
    );
    const applicantRefsById = new Map(latestApplicants.map(item => [item.applicantId, item.ref]));

    transaction.update(doc(db, 'interviewRounds', roundId), adminRoundData(draft));
    transaction.set(doc(db, 'interviewPublicRounds', roundId), publicRoundData(draft));
    affected.forEach(item => transaction.update(item.ref, {
      availability: item.availability,
      updatedAt: serverTimestamp(),
    }));
    assignmentImpact.affectedAssignments.forEach(item => {
      const ref = applicantRefsById.get(item.applicantId);
      if (ref) {
        const applicant = latestApplicants.find(candidate => candidate.applicantId === item.applicantId);
        const currentRevision = applicant?.assignment?.confirmationRevision ?? 0;
        if (applicant?.assignment?.slotId) {
          transaction.delete(doc(
            db,
            'interviewAssignmentLocks',
            getAssignmentLockId(roundId, applicant.assignment),
          ));
        }
        transaction.update(ref, {
          assignment: null,
          assignmentRevision: currentRevision + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
    return {
      cleanedResponseCount: affected.length,
      clearedAssignmentCount: assignmentImpact.affectedAssignmentCount,
    };
  });
}

export async function setInterviewAccessActive(token: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'interviewAccess', token), { active });
}
