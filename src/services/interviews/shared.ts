import { Timestamp, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewV3Policy';
import { getApplicantAssignmentRevision } from '../../domain/interviews/interviewTransitions';
import type {
  InterviewApplicant,
  InterviewAssignment,
  InterviewNote,
  InterviewPublicRound,
} from '../../types';
import type { InterviewRoundDraft } from './models';

export function mapSnapshot<T extends { id: string }>(snapshot: { docs: Array<{ id: string; data(): DocumentData }> }): T[] {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T));
}

export function isActiveApplicant(applicant: InterviewApplicant) {
  return (applicant.lifecycle ?? 'active') === 'active'
    && (applicant.applicationStatus ?? 'active') === 'active';
}

export function currentAssignmentRevision(applicant: InterviewApplicant) {
  return getApplicantAssignmentRevision(applicant);
}

export function isCurrentConfirmationSent(applicant: InterviewApplicant) {
  return Boolean(applicant.assignment)
    && applicant.confirmationMessage?.lastMarkedSentAt != null
    && (applicant.confirmationMessage.assignmentRevision ?? 0) === currentAssignmentRevision(applicant);
}

export function getAssignmentLockId(roundId: string, assignment: Pick<InterviewAssignment, 'interviewerId' | 'slotId'>) {
  if (!assignment.slotId) throw new Error('면접 배정 슬롯 ID가 없습니다.');
  return [roundId, assignment.interviewerId, assignment.slotId].map(encodeURIComponent).join('__');
}

export function actorEmail() {
  return auth.currentUser?.email?.trim().toLowerCase() ?? null;
}

export function sharedRoundData(draft: InterviewRoundDraft) {
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

export function publicRoundData(draft: InterviewRoundDraft, scheduleRevision: number): Omit<InterviewPublicRound, 'id' | 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } {
  return { ...sharedRoundData(draft), scheduleRevision, active: true, updatedAt: serverTimestamp() };
}

export function adminRoundData(draft: InterviewRoundDraft, scheduleRevision: number) {
  return {
    ...sharedRoundData(draft),
    scheduleRevision,
    assignmentSlotMinutes: draft.assignmentSlotMinutes,
    messageTemplates: draft.messageTemplates,
    interviewQuestions: draft.interviewQuestions,
    updatedAt: serverTimestamp(),
  };
}

export function interviewRecordSnapshot(applicant: InterviewApplicant, note?: InterviewNote) {
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

export function hasInterviewRecord(applicant: InterviewApplicant, note?: InterviewNote) {
  return Boolean(note || applicant.overallRating || getInterviewProgressStatus(applicant) === 'completed');
}
