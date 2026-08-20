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
import { auth, db } from '../lib/firebase';
import { availabilityToAssignmentCandidates, getAssignmentScheduleImpact } from '../domain/interviews/scheduling';
import { normalizeApplicantNumber } from '../domain/interviews/applicantMerge';
import { OVERALL_RATINGS, prepareInterviewCompletion } from '../domain/interviews/interviewCompletion';
import { getInterviewProgressStatus } from '../domain/interviews/interviewV3Policy';
import {
  getApplicantAssignmentRevision,
  prepareReissuedAccess,
  prepareScheduleResetTransition,
  prepareWithdrawalTransition,
} from '../domain/interviews/interviewTransitions';
import type {
  InterviewAccess,
  InterviewApplicant,
  InterviewApplicationField,
  InterviewAssignment,
  InterviewAssignmentStatus,
  InterviewDaySchedule,
  InterviewQuestion,
  InterviewNote,
  InterviewOverallRating,
  InterviewProgressStatus,
  InterviewSelectionStatus,
  InterviewerProfile,
  InterviewRoundInterviewer,
  InterviewChangeRequest,
  InterviewPublicRound,
  InterviewRound,
  InterviewRoundStatus,
} from '../types';

function isActiveApplicant(applicant: InterviewApplicant) {
  return (applicant.lifecycle ?? 'active') === 'active'
    && (applicant.applicationStatus ?? 'active') === 'active';
}

function currentAssignmentRevision(applicant: InterviewApplicant) {
  return getApplicantAssignmentRevision(applicant);
}

function isCurrentConfirmationSent(applicant: InterviewApplicant) {
  return Boolean(applicant.assignment)
    && applicant.confirmationMessage?.lastMarkedSentAt != null
    && (applicant.confirmationMessage.assignmentRevision ?? 0) === currentAssignmentRevision(applicant);
}

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
  daySchedules: InterviewDaySchedule[];
  interviewQuestions: InterviewQuestion[];
}

export interface ApplicantImportRow {
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  sourceRowNumber: number;
}

export interface ApplicantDraft {
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
}

export interface ApplicantMergeCommitItem extends ApplicantImportRow {
  action: 'create' | 'update';
  existingId?: string;
}

export interface RoundInterviewerDraft {
  name: string;
  email?: string | null;
}

export interface AssignmentProposalWrite {
  applicantId: string;
  /** Revision observed when the automatic-assignment draft was created. */
  expectedAssignmentRevision: number;
  slotId: string;
  startsAt: Timestamp;
  durationMinutes: number;
  interviewerId: string;
  interviewerName: string;
  locked: boolean;
  source: 'manual' | 'automatic';
  status?: InterviewAssignmentStatus;
}

export interface InterviewApplicantWithAccess extends InterviewApplicant {
  access: InterviewAccess | null;
  link: string;
}

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
    daySchedules: draft.daySchedules,
    timeZone: 'Asia/Seoul' as const,
    schemaVersion: 2 as const,
  };
}

function publicRoundData(draft: InterviewRoundDraft, scheduleRevision: number): Omit<InterviewPublicRound, 'id' | 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } {
  return { ...sharedRoundData(draft), scheduleRevision, active: true, updatedAt: serverTimestamp() };
}

function adminRoundData(draft: InterviewRoundDraft, scheduleRevision: number) {
  return {
    ...sharedRoundData(draft),
    scheduleRevision,
    assignmentSlotMinutes: draft.assignmentSlotMinutes,
    messageTemplates: draft.messageTemplates,
    interviewQuestions: draft.interviewQuestions,
    updatedAt: serverTimestamp(),
  };
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

export async function reissueInterviewAccessToken(applicantId: string): Promise<string> {
  const nextToken = generateInterviewToken();
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const previousToken = applicant.accessToken;
    const previousAccessRef = doc(db, 'interviewAccess', previousToken);
    const nextAccessRef = doc(db, 'interviewAccess', nextToken);
    const [previousAccessSnapshot, nextAccessSnapshot] = await Promise.all([
      transaction.get(previousAccessRef),
      transaction.get(nextAccessRef),
    ]);
    if (!previousAccessSnapshot.exists()) throw new Error('기존 공개 링크 정보를 찾을 수 없습니다.');
    if (nextAccessSnapshot.exists()) throw new Error('새 링크 생성이 충돌했습니다. 다시 시도해주세요.');
    const previousAccess = previousAccessSnapshot.data() as InterviewAccess;
    if (previousAccess.changeRequestStatus === 'open') {
      throw new Error('처리 중인 일정 변경 요청을 먼저 해결한 뒤 링크를 재발급해주세요.');
    }
    transaction.set(nextAccessRef, {
      ...prepareReissuedAccess(previousAccess, previousToken, isActiveApplicant(applicant)),
      createdAt: serverTimestamp(),
    });
    transaction.update(previousAccessRef, {
      active: false,
      supersededBy: nextToken,
      supersededAt: serverTimestamp(),
    });
    transaction.update(applicantRef, {
      accessToken: nextToken,
      updatedAt: serverTimestamp(),
    });
  });
  return nextToken;
}

function getAssignmentLockId(roundId: string, assignment: Pick<InterviewAssignment, 'interviewerId' | 'slotId'>) {
  if (!assignment.slotId) throw new Error('면접 배정 슬롯 ID가 없습니다.');
  return [roundId, assignment.interviewerId, assignment.slotId].map(encodeURIComponent).join('__');
}

function getApplicantKeyId(roundId: string, applicantNumber: string) {
  return [roundId, normalizeApplicantNumber(applicantNumber)].map(encodeURIComponent).join('__');
}

function actorEmail() {
  return auth.currentUser?.email?.trim().toLowerCase() ?? null;
}

function interviewRecordSnapshot(applicant: InterviewApplicant, note?: InterviewNote) {
  const overallRating = note?.overallRating ?? applicant.overallRating ?? null;
  return {
    assignmentRevision: currentAssignmentRevision(applicant),
    assignment: applicant.assignment ?? null,
    interviewStatus: getInterviewProgressStatus(applicant),
    overallRating,
    noteSnapshot: note ? {
      interviewerId: note.interviewerId ?? '',
      interviewerName: note.interviewerName ?? '',
      generalNotes: note.generalNotes ?? '',
      answers: note.answers ?? {},
      overallRating,
      createdAt: note.createdAt ?? null,
      updatedAt: note.updatedAt ?? null,
      updatedBy: note.updatedBy ?? null,
    } : null,
  };
}

function hasInterviewRecord(applicant: InterviewApplicant, note?: InterviewNote) {
  return Boolean(note || applicant.overallRating || getInterviewProgressStatus(applicant) === 'completed');
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

export async function getInterviewRound(roundId: string): Promise<InterviewRound | null> {
  const snapshot = await getDoc(doc(db, 'interviewRounds', roundId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewRound) : null;
}

export function subscribeInterviewRound(
  roundId: string,
  onData: (round: InterviewRound | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
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
      if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자에게는 확정 안내를 기록할 수 없습니다.');
      if (!currentAssignment) throw new Error('현재 면접 배정이 없어 확정 안내를 기록할 수 없습니다.');
    }

    const revision = currentAssignmentRevision(applicant);
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

export async function saveInterviewAssignment(
  applicantId: string,
  assignment: InterviewAssignment | null,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (assignment && !isActiveApplicant(applicant)) {
      throw new Error('지원 철회 또는 보관된 지원자는 배정할 수 없습니다.');
    }
    const currentAssignment = applicant.assignment;
    const previousRevision = currentAssignmentRevision(applicant);
    const nextRevision = previousRevision + 1;
    const nextAssignment = assignment
      ? { ...assignment, status: 'scheduled' as const, confirmationRevision: nextRevision }
      : null;

    let nextLockRef: DocumentReference | null = null;
    if (nextAssignment) {
      nextLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, nextAssignment));
      const [lockSnapshot, roundSnapshot, accessSnapshot, participantSnapshot] = await Promise.all([
        transaction.get(nextLockRef),
        transaction.get(doc(db, 'interviewRounds', applicant.roundId)),
        transaction.get(doc(db, 'interviewAccess', applicant.accessToken)),
        transaction.get(doc(db, 'interviewRoundInterviewers', `${applicant.roundId}__${nextAssignment.interviewerId}`)),
      ]);
      if (lockSnapshot.exists() && lockSnapshot.data().applicantId !== applicantId) {
        throw new Error('같은 면접관에게 이미 배정된 시간입니다.');
      }
      if (!roundSnapshot.exists() || !accessSnapshot.exists() || !participantSnapshot.exists()) throw new Error('최신 면접 가능시간 정보를 찾을 수 없습니다.');
      const round = roundSnapshot.data() as InterviewRound;
      const access = accessSnapshot.data() as InterviewAccess;
      const participant = participantSnapshot.data() as InterviewRoundInterviewer;
      const applicantCandidates = availabilityToAssignmentCandidates(access.availability, round.availabilitySlotMinutes, round.assignmentSlotMinutes);
      const interviewerCandidates = availabilityToAssignmentCandidates(participant.availability, round.availabilitySlotMinutes, round.assignmentSlotMinutes);
      if (!participant.active || !nextAssignment.slotId || !applicantCandidates.includes(nextAssignment.slotId) || !interviewerCandidates.includes(nextAssignment.slotId)) {
        throw new Error('지원자와 면접관의 최신 가능시간이 겹치지 않습니다.');
      }
      if (nextAssignment.durationMinutes !== round.assignmentSlotMinutes) throw new Error('현재 회차의 면접 배정 단위와 다릅니다.');
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
      previousAssignment: currentAssignment ?? null,
      assignmentRevision: nextRevision,
      ...(nextAssignment ? { interviewStatus: 'scheduled', actionNeededReason: null } : {}),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      assignmentSummary: nextAssignment?.slotId ? {
        slotId: nextAssignment.slotId,
        interviewerName: nextAssignment.interviewerName,
        status: nextAssignment.status,
        revision: nextRevision,
      } : null,
    });
    const eventRef = doc(collection(db, 'interviewAssignmentEvents'));
    transaction.set(eventRef, {
      roundId: applicant.roundId,
      applicantId,
      type: !currentAssignment && nextAssignment ? 'assigned' : currentAssignment && !nextAssignment ? 'unassigned' : 'changed',
      previousAssignment: currentAssignment ?? null,
      nextAssignment,
      previousRevision,
      nextRevision,
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function applyInterviewAssignmentProposals(
  roundId: string,
  proposals: AssignmentProposalWrite[],
): Promise<number> {
  const resourceKeys = proposals.map(proposal => `${proposal.interviewerId}|${proposal.slotId}`);
  if (new Set(resourceKeys).size !== resourceKeys.length) throw new Error('초안 안에 면접관 시간 충돌이 있습니다.');
  if (new Set(proposals.map(proposal => proposal.applicantId)).size !== proposals.length) throw new Error('한 지원자가 초안에 두 번 포함되어 있습니다.');
  await runTransaction(db, async transaction => {
    const applicantRefs = proposals.map(proposal => doc(db, 'interviewApplicants', proposal.applicantId));
    const applicantSnapshots = await Promise.all(applicantRefs.map(ref => transaction.get(ref)));
    const roundSnapshot = await transaction.get(doc(db, 'interviewRounds', roundId));
    if (!roundSnapshot.exists()) throw new Error('면접 회차를 찾을 수 없습니다.');
    const round = roundSnapshot.data() as InterviewRound;
    const accessSnapshots = await Promise.all(applicantSnapshots.map(snapshot => {
      const applicant = snapshot.data() as InterviewApplicant | undefined;
      return applicant?.accessToken ? transaction.get(doc(db, 'interviewAccess', applicant.accessToken)) : Promise.resolve(null);
    }));
    const participantIds = [...new Set(proposals.map(proposal => proposal.interviewerId))];
    const participantSnapshots = await Promise.all(participantIds.map(interviewerId => transaction.get(doc(db, 'interviewRoundInterviewers', `${roundId}__${interviewerId}`))));
    const participantByInterviewer = new Map(participantSnapshots.filter(snapshot => snapshot.exists()).map(snapshot => {
      const data = snapshot.data() as InterviewRoundInterviewer;
      return [data.interviewerId, data] as const;
    }));
    const nextLockRefs = proposals.map(proposal => doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, proposal)));
    const nextLockSnapshots = await Promise.all(nextLockRefs.map(ref => transaction.get(ref)));
    const proposalByApplicant = new Map(proposals.map(proposal => [proposal.applicantId, proposal]));
    nextLockSnapshots.forEach((snapshot, index) => {
      const proposal = proposals[index];
      const holderId = snapshot.data()?.applicantId as string | undefined;
      const holderProposal = holderId ? proposalByApplicant.get(holderId) : undefined;
      const holderMovesAway = holderProposal && proposal
        ? `${holderProposal.interviewerId}|${holderProposal.slotId}` !== `${proposal.interviewerId}|${proposal.slotId}`
        : false;
      if (snapshot.exists() && holderId !== proposal?.applicantId && !holderMovesAway) {
        throw new Error('검토 중 다른 운영진이 같은 면접관 시간에 배정했습니다. 자동 배정을 다시 실행해주세요.');
      }
    });
    applicantSnapshots.forEach((applicantSnapshot, index) => {
      const proposal = proposals[index];
      if (!applicantSnapshot?.exists() || !proposal) return;
      const current = (applicantSnapshot.data() as InterviewApplicant).assignment;
      if (!current?.slotId) return;
      const currentLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, current));
      if (currentLockRef.path !== nextLockRefs[index]?.path) transaction.delete(currentLockRef);
    });
    proposals.forEach((proposal, index) => {
      const applicantSnapshot = applicantSnapshots[index];
      if (!applicantSnapshot?.exists()) throw new Error('지원자를 찾을 수 없습니다.');
      const applicant = applicantSnapshot.data() as InterviewApplicant;
      if (applicant.roundId !== roundId) throw new Error('다른 회차의 지원자가 포함되어 있습니다.');
      if (!isActiveApplicant(applicant)) throw new Error(`${applicant.name} 지원자는 지원 철회 또는 보관 상태입니다.`);
      const current = applicant.assignment;
      const previousRevision = currentAssignmentRevision(applicant);
      if (proposal.expectedAssignmentRevision !== previousRevision) {
        throw new Error(`${applicant.name} 지원자의 일정이 초안 작성 후 변경되었습니다. 자동 배정을 다시 실행해주세요.`);
      }
      const progressStatus = applicant.interviewStatus
        ?? (current?.status === 'completed' ? 'completed' : 'scheduled');
      if (progressStatus === 'completed' || progressStatus === 'action_needed') {
        throw new Error(`${applicant.name} 지원자는 면접 완료 또는 조치 필요 상태입니다. 먼저 별도 절차로 상태를 처리해주세요.`);
      }
      if (current && ['completed', 'no_show', 'cancelled', 'needs_reschedule'].includes(current.status)) {
        throw new Error(`${applicant.name} 지원자의 현재 면접 상태에는 자동 배정을 적용할 수 없습니다.`);
      }
      const access = accessSnapshots[index]?.data() as InterviewAccess | undefined;
      if (access?.changeRequestStatus === 'open') {
        throw new Error(`${applicant.name} 지원자는 일정 변경 요청을 처리한 뒤 자동 배정할 수 있습니다.`);
      }
      const participant = participantByInterviewer.get(proposal.interviewerId);
      const applicantCandidates = availabilityToAssignmentCandidates(access?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes);
      const interviewerCandidates = availabilityToAssignmentCandidates(participant?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes);
      if (!participant?.active || !applicantCandidates.includes(proposal.slotId) || !interviewerCandidates.includes(proposal.slotId)) {
        throw new Error(`${applicant.name} 지원자의 초안 후보가 최신 가능시간과 다릅니다. 자동 배정을 다시 실행해주세요.`);
      }
      if (proposal.durationMinutes !== round.assignmentSlotMinutes) throw new Error('면접 배정 단위가 변경되었습니다. 자동 배정을 다시 실행해주세요.');
      if (current?.locked && (current.slotId !== proposal.slotId || current.interviewerId !== proposal.interviewerId)) {
        throw new Error(`${applicant.name} 지원자의 잠긴 배정이 변경되었습니다.`);
      }
      const assignmentChanges = !current
        || current.slotId !== proposal.slotId
        || current.interviewerId !== proposal.interviewerId;
      if (assignmentChanges && isCurrentConfirmationSent(applicant)) {
        throw new Error(`${applicant.name} 지원자는 현재 일정의 확정 안내를 받아 자동으로 이동할 수 없습니다.`);
      }
      const revision = previousRevision + 1;
      const next: InterviewAssignment = {
        slotId: proposal.slotId,
        startsAt: proposal.startsAt,
        durationMinutes: proposal.durationMinutes,
        interviewerId: proposal.interviewerId,
        interviewerName: proposal.interviewerName,
        status: 'scheduled',
        locked: proposal.locked,
        source: proposal.source,
        confirmationRevision: revision,
      };
      transaction.set(nextLockRefs[index]!, {
        roundId,
        applicantId: proposal.applicantId,
        interviewerId: proposal.interviewerId,
        slotId: proposal.slotId,
        startsAt: proposal.startsAt,
        durationMinutes: proposal.durationMinutes,
        updatedAt: serverTimestamp(),
      });
      transaction.update(applicantRefs[index]!, {
        assignment: next,
        previousAssignment: current ?? null,
        assignmentRevision: revision,
        interviewStatus: 'scheduled',
        actionNeededReason: null,
        updatedAt: serverTimestamp(),
      });
      transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
        assignmentSummary: { slotId: next.slotId, interviewerName: next.interviewerName, status: next.status, revision },
      });
      transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
        roundId,
        applicantId: proposal.applicantId,
        type: current ? 'changed' : 'assigned',
        previousAssignment: current ?? null,
        nextAssignment: next,
        previousRevision,
        nextRevision: revision,
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    });
  });
  return proposals.length;
}

export async function updateInterviewAssignmentState(
  applicantId: string,
  patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!applicant.assignment) throw new Error('면접 배정이 없습니다.');
    if (patch.status === 'completed') throw new Error('면접 완료는 종합평가와 함께 완료 기능에서 처리해야 합니다.');
    if (patch.status && getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('이미 완료된 면접의 배정 상태는 이 기능으로 변경할 수 없습니다.');
    }
    const next = { ...applicant.assignment, ...patch };
    const actionNeeded = patch.status != null
      && ['change_requested', 'no_show', 'cancelled', 'needs_reschedule'].includes(patch.status);
    const actionNeededReason = patch.status === 'no_show'
      ? '면접 불참'
      : patch.status === 'cancelled'
        ? '면접 취소'
        : patch.status === 'needs_reschedule' || patch.status === 'change_requested'
          ? '일정 재조율 필요'
          : null;
    transaction.update(applicantRef, {
      assignment: next,
      ...(actionNeeded ? {
        interviewStatus: 'action_needed' satisfies InterviewProgressStatus,
        actionNeededReason,
      } : patch.status ? {
        interviewStatus: 'scheduled' satisfies InterviewProgressStatus,
        actionNeededReason: null,
      } : {}),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': next.status,
    });
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: patch.locked === true ? 'locked' : patch.locked === false ? 'unlocked' : 'status_changed',
      previousAssignment: applicant.assignment,
      nextAssignment: next,
      previousRevision: currentAssignmentRevision(applicant),
      nextRevision: currentAssignmentRevision(applicant),
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
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
        ? [{ applicantId: snapshot.id, assignment: data.assignment, applicant: data, ref: snapshot.ref }]
        : [];
    });
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      latestApplicants,
    );
    const applicantRefsById = new Map(latestApplicants.map(item => [item.applicantId, item.ref]));

    const roundRef = doc(db, 'interviewRounds', roundId);
    const currentRoundSnapshot = await transaction.get(roundRef);
    const nextScheduleRevision = ((currentRoundSnapshot.data()?.scheduleRevision as number | undefined) ?? 0) + 1;
    transaction.update(roundRef, adminRoundData(draft, nextScheduleRevision));
    transaction.set(doc(db, 'interviewPublicRounds', roundId), publicRoundData(draft, nextScheduleRevision));
    affected.forEach(item => transaction.update(item.ref, {
      availability: item.availability,
      updatedAt: serverTimestamp(),
    }));
    assignmentImpact.affectedAssignments.forEach(item => {
      const ref = applicantRefsById.get(item.applicantId);
      if (ref) {
        const applicant = latestApplicants.find(candidate => candidate.applicantId === item.applicantId);
        const currentRevision = applicant ? currentAssignmentRevision(applicant.applicant) : 0;
        if (applicant?.assignment?.slotId) {
          transaction.delete(doc(
            db,
            'interviewAssignmentLocks',
            getAssignmentLockId(roundId, applicant.assignment),
          ));
        }
          transaction.update(ref, {
          assignment: null,
          previousAssignment: applicant?.assignment ?? null,
          assignmentRevision: currentRevision + 1,
          updatedAt: serverTimestamp(),
          });
          if (applicant) {
            if (applicant.applicant.accessToken) transaction.update(doc(db, 'interviewAccess', applicant.applicant.accessToken), { assignmentSummary: null });
            transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
              roundId,
              applicantId: item.applicantId,
              type: 'unassigned',
              previousAssignment: applicant.assignment ?? null,
              nextAssignment: null,
              previousRevision: currentRevision,
              nextRevision: currentRevision + 1,
              reason: '회차 일정 설정 변경',
              createdAt: serverTimestamp(),
              createdBy: actorEmail(),
            });
          }
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

export async function resetInterviewApplicantSchedule(applicantId: string): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) {
      throw new Error('지원 철회 또는 보관된 지원자는 정상 상태로 복구한 뒤 일정을 초기화할 수 있습니다.');
    }
    const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
    const accessSnapshot = await transaction.get(accessRef);
    if (!accessSnapshot.exists()) throw new Error('지원자의 공개 링크 정보를 찾을 수 없습니다.');
    const changeRequestRef = doc(db, 'interviewChangeRequests', applicant.accessToken);
    const changeRequestSnapshot = await transaction.get(changeRequestRef);
    const noteSnapshot = await transaction.get(doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`));
    const note = noteSnapshot.data() as InterviewNote | undefined;

    const transition = prepareScheduleResetTransition(applicant);
    const { previousAssignment, previousRevision, nextRevision } = transition;
    if (previousAssignment?.slotId) {
      transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, previousAssignment)));
    }
    transaction.update(applicantRef, {
      ...transition.applicantPatch,
      updatedAt: serverTimestamp(),
    });
    transaction.update(accessRef, {
      ...transition.accessPatch,
      ...(accessSnapshot.data().changeRequestStatus === 'open' ? { changeRequestStatus: 'resolved' } : {}),
    });
    if (changeRequestSnapshot.exists() && changeRequestSnapshot.data().status === 'open') {
      transaction.update(changeRequestRef, {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: actorEmail(),
      });
    }
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'schedule_reset',
      previousAssignment,
      nextAssignment: null,
      previousRevision,
      nextRevision,
      reason: '일정 초기화',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    if (hasInterviewRecord(applicant, note)) {
      transaction.set(doc(collection(db, 'interviewRecordEvents')), {
        roundId: applicant.roundId,
        applicantId,
        type: 'schedule_reset_snapshot',
        ...interviewRecordSnapshot(applicant, note),
        reason: '일정 초기화 전 기록 보존',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    }
  });
}

export async function setInterviewApplicantWithdrawn(applicantId: string, withdrawn: boolean): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
    const accessSnapshot = await transaction.get(accessRef);
    if (!accessSnapshot.exists()) throw new Error('지원자의 공개 링크 정보를 찾을 수 없습니다.');
    const changeRequestRef = doc(db, 'interviewChangeRequests', applicant.accessToken);
    const changeRequestSnapshot = await transaction.get(changeRequestRef);
    const noteSnapshot = await transaction.get(doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`));
    const note = noteSnapshot.data() as InterviewNote | undefined;

    const wasWithdrawn = (applicant.applicationStatus ?? 'active') === 'withdrawn';
    if (wasWithdrawn === withdrawn) return;
    const transition = prepareWithdrawalTransition(applicant, withdrawn);
    const { activeAssignment, previousRevision, nextRevision } = transition;
    if (withdrawn && activeAssignment?.slotId) {
      transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, activeAssignment)));
    }
    transaction.update(applicantRef, {
      ...transition.applicantPatch,
      withdrawnAt: withdrawn ? serverTimestamp() : null,
      withdrawnBy: withdrawn ? actorEmail() : null,
      updatedAt: serverTimestamp(),
    });
    transaction.update(accessRef, {
      ...transition.accessPatch,
      ...(accessSnapshot.data().changeRequestStatus === 'open' ? { changeRequestStatus: 'dismissed' } : {}),
    });
    if (changeRequestSnapshot.exists() && changeRequestSnapshot.data().status === 'open') {
      transaction.update(changeRequestRef, {
        status: 'dismissed',
        resolvedAt: serverTimestamp(),
        resolvedBy: actorEmail(),
      });
    }
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: withdrawn ? 'withdrawn' : 'restored',
      previousAssignment: withdrawn ? activeAssignment : null,
      nextAssignment: null,
      previousRevision,
      nextRevision,
      reason: withdrawn ? '지원 철회' : '지원 철회 취소',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    if (withdrawn && hasInterviewRecord(applicant, note)) {
      transaction.set(doc(collection(db, 'interviewRecordEvents')), {
        roundId: applicant.roundId,
        applicantId,
        type: 'withdrawal_snapshot',
        ...interviewRecordSnapshot(applicant, note),
        reason: '지원 철회 전 기록 보존',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
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
  await runTransaction(db, async transaction => {
    const newKeySnapshot = await transaction.get(newKeyRef);
    if (newKeySnapshot.exists() && newKeySnapshot.data().applicantId !== applicant.id) throw new Error('이미 등록된 지원번호입니다.');
    if (oldKeyRef.path !== newKeyRef.path) transaction.delete(oldKeyRef);
    transaction.set(newKeyRef, { roundId: applicant.roundId, applicantId: applicant.id, applicantNumber: normalizeApplicantNumber(draft.applicantNumber), updatedAt: serverTimestamp() });
    transaction.update(doc(db, 'interviewApplicants', applicant.id), {
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
        roundId, applicantNumber: item.applicantNumber.trim(), name: item.name.trim(), phone: item.phone.trim(),
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
        roundId, applicantId: applicantRef.id, displayName: item.name.trim(), availability: [], submittedAt: null,
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

export function subscribeRoundInterviewers(
  roundId: string,
  onData: (items: InterviewRoundInterviewer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewRoundInterviewers'), where('roundId', '==', roundId)), snapshot => {
    onData(mapSnapshot<InterviewRoundInterviewer>(snapshot).sort((left, right) => left.displayName.localeCompare(right.displayName)));
  }, onError);
}

export async function addRoundInterviewer(roundId: string, draft: RoundInterviewerDraft): Promise<string> {
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
  await batch.commit();
  return profileRef.id;
}

export async function updateRoundInterviewerAvailability(participantId: string, availability: string[]): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participantId), { availability: [...new Set(availability)].sort(), updatedAt: serverTimestamp() });
}

export async function removeRoundInterviewer(participant: InterviewRoundInterviewer): Promise<void> {
  await updateDoc(doc(db, 'interviewRoundInterviewers', participant.id), { active: false, updatedAt: serverTimestamp() });
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

export function subscribeInterviewNote(
  roundId: string,
  applicantId: string,
  onData: (note: InterviewNote | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const noteId = `${roundId}__${applicantId}`;
  return onSnapshot(doc(db, 'interviewNotes', noteId), snapshot => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewNote) : null);
  }, onError);
}

export async function saveInterviewNote(input: {
  roundId: string;
  applicantId: string;
  interviewerId: string;
  interviewerName: string;
  generalNotes: string;
  answers: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
}): Promise<void> {
  if (input.overallRating != null && !OVERALL_RATINGS.includes(input.overallRating)) {
    throw new Error('올바르지 않은 종합평가입니다.');
  }
  const noteRef = doc(db, 'interviewNotes', `${input.roundId}__${input.applicantId}`);
  const applicantRef = doc(db, 'interviewApplicants', input.applicantId);
  await runTransaction(db, async transaction => {
    const [noteSnapshot, applicantSnapshot] = await Promise.all([
      transaction.get(noteRef),
      transaction.get(applicantRef),
    ]);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (applicant.roundId !== input.roundId) throw new Error('다른 면접 회차의 지원자입니다.');
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자의 면접 기록은 수정할 수 없습니다.');
    // A pending autosave that races the final completion transaction must not
    // overwrite the rating and notes that were atomically finalized there.
    if (getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('완료된 면접의 평가는 선발 상세에서 수정해주세요.');
    }
    transaction.set(noteRef, {
      ...input,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    if ('overallRating' in input) {
      transaction.update(applicantRef, {
        overallRating: input.overallRating ?? null,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function updateCompletedInterviewOverallRating(
  applicantId: string,
  overallRating: InterviewOverallRating,
): Promise<void> {
  if (!OVERALL_RATINGS.includes(overallRating)) throw new Error('올바르지 않은 종합평가입니다.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자의 평가는 수정할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) !== 'completed') throw new Error('완료된 면접의 평가만 이곳에서 수정할 수 있습니다.');
    const noteRef = doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`);
    const noteSnapshot = await transaction.get(noteRef);
    const note = noteSnapshot.data() as InterviewNote | undefined;
    const assignment = applicant.assignment ?? applicant.previousAssignment;
    transaction.set(noteRef, {
      roundId: applicant.roundId,
      applicantId,
      interviewerId: note?.interviewerId ?? assignment?.interviewerId ?? '',
      interviewerName: note?.interviewerName ?? assignment?.interviewerName ?? '',
      generalNotes: note?.generalNotes ?? '',
      answers: note?.answers ?? {},
      overallRating,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    transaction.update(applicantRef, {
      overallRating,
      updatedAt: serverTimestamp(),
    });
    const previousOverallRating = note?.overallRating ?? applicant.overallRating ?? null;
    const updatedApplicant = { ...applicant, overallRating };
    const updatedNote = {
      ...(note ?? {}),
      interviewerId: note?.interviewerId ?? assignment?.interviewerId ?? '',
      interviewerName: note?.interviewerName ?? assignment?.interviewerName ?? '',
      generalNotes: note?.generalNotes ?? '',
      answers: note?.answers ?? {},
      overallRating,
    } as InterviewNote;
    transaction.set(doc(collection(db, 'interviewRecordEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'rating_changed',
      ...interviewRecordSnapshot(updatedApplicant, updatedNote),
      previousOverallRating,
      nextOverallRating: overallRating,
      reason: '면접 완료 후 종합평가 정정',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function setInterviewActionNeeded(applicantId: string, reason = ''): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 처리할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('이미 완료된 면접은 조치 필요로 변경할 수 없습니다.');
    }
    transaction.update(applicantRef, {
      interviewStatus: 'action_needed' satisfies InterviewProgressStatus,
      actionNeededReason: reason.trim().slice(0, 500) || null,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function restoreScheduledInterview(applicantId: string): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 처리할 수 없습니다.');
    if (!applicant.assignment) throw new Error('현재 면접 배정이 없습니다.');
    if (getInterviewProgressStatus(applicant) === 'completed') throw new Error('이미 완료된 면접입니다.');
    const restoredAssignment = {
      ...applicant.assignment,
      status: isCurrentConfirmationSent(applicant) ? 'confirmed' as const : 'scheduled' as const,
    };
    transaction.update(applicantRef, {
      assignment: restoredAssignment,
      interviewStatus: 'scheduled' satisfies InterviewProgressStatus,
      actionNeededReason: null,
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': restoredAssignment.status,
    });
  });
}

export interface CompleteInterviewInput {
  roundId: string;
  applicantId: string;
  interviewerId: string;
  interviewerName: string;
  generalNotes?: string;
  answers?: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
}

export async function completeInterviewAtomically(input: CompleteInterviewInput): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', input.applicantId);
  const noteRef = doc(db, 'interviewNotes', `${input.roundId}__${input.applicantId}`);
  await runTransaction(db, async transaction => {
    const [applicantSnapshot, noteSnapshot] = await Promise.all([
      transaction.get(applicantRef),
      transaction.get(noteRef),
    ]);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const existingNote = noteSnapshot.data() as InterviewNote | undefined;
    const completion = prepareInterviewCompletion(applicant, existingNote ?? null, input);

    transaction.set(noteRef, {
      roundId: input.roundId,
      applicantId: input.applicantId,
      interviewerId: completion.interviewerId,
      interviewerName: completion.interviewerName,
      generalNotes: completion.generalNotes,
      answers: completion.answers,
      overallRating: completion.overallRating,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    transaction.update(applicantRef, {
      assignment: completion.completedAssignment,
      interviewStatus: 'completed' satisfies InterviewProgressStatus,
      actionNeededReason: null,
      overallRating: completion.overallRating,
      interviewCompletedAt: serverTimestamp(),
      interviewCompletedBy: actorEmail(),
      selectionStatus: applicant.selectionStatus ?? 'pending',
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': 'completed',
    });
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId: input.applicantId,
      type: 'status_changed',
      previousAssignment: applicant.assignment,
      nextAssignment: completion.completedAssignment,
      previousRevision: currentAssignmentRevision(applicant),
      nextRevision: currentAssignmentRevision(applicant),
      reason: '면접 완료',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    const completedApplicant = {
      ...applicant,
      assignment: completion.completedAssignment,
      interviewStatus: 'completed' as const,
      overallRating: completion.overallRating,
    };
    const completedNote = {
      ...(existingNote ?? {}),
      interviewerId: completion.interviewerId,
      interviewerName: completion.interviewerName,
      generalNotes: completion.generalNotes,
      answers: completion.answers,
      overallRating: completion.overallRating,
    } as InterviewNote;
    transaction.set(doc(collection(db, 'interviewRecordEvents')), {
      roundId: applicant.roundId,
      applicantId: input.applicantId,
      type: 'completed',
      ...interviewRecordSnapshot(completedApplicant, completedNote),
      reason: '면접 완료 시점 기록',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function updateInterviewSelectionStatus(
  applicantId: string,
  selectionStatus: InterviewSelectionStatus,
): Promise<void> {
  const allowed: InterviewSelectionStatus[] = ['pending', 'selected', 'rejected'];
  if (!allowed.includes(selectionStatus)) throw new Error('올바르지 않은 선발 상태입니다.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 선발 대상으로 처리할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) !== 'completed') {
      throw new Error('면접 완료자만 선발 상태를 변경할 수 있습니다.');
    }
    transaction.update(applicantRef, {
      selectionStatus,
      selectionDecidedAt: selectionStatus === 'pending' ? null : serverTimestamp(),
      selectionDecidedBy: selectionStatus === 'pending' ? null : actorEmail(),
      updatedAt: serverTimestamp(),
    });
  });
}
