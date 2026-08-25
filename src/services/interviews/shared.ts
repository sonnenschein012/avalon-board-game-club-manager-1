import { Timestamp, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewV3Policy';
import { getApplicantAssignmentRevision } from '../../domain/interviews/interviewTransitions';
import type {
  InterviewApplicant,
  InterviewAssignment,
  InterviewNote,
  InterviewPublicRound,
  InterviewPublicSchedule,
} from '../../types';
import type { InterviewRoundDraft, InterviewScheduleDraft } from './models';

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

function sharedScheduleData(roundId: string, draft: InterviewScheduleDraft) {
  return {
    roundId,
    name: draft.name.trim(),
    surveyOpensAt: Timestamp.fromDate(draft.surveyOpensAt),
    surveyClosesAt: Timestamp.fromDate(draft.surveyClosesAt),
    interviewDates: [...draft.interviewDates].sort(),
    dayStartTime: draft.dayStartTime,
    dayEndTime: draft.dayEndTime,
    availabilitySlotMinutes: draft.availabilitySlotMinutes,
    assignmentSlotMinutes: draft.assignmentSlotMinutes,
    status: draft.status,
    instructions: draft.instructions,
    allowedSlots: [...new Set(draft.allowedSlots)].sort(),
    daySchedules: [...draft.daySchedules].sort((left, right) => left.date.localeCompare(right.date)),
    timeZone: 'Asia/Seoul' as const,
    schemaVersion: 1 as const,
  };
}

export function adminScheduleData(roundId: string, draft: InterviewScheduleDraft, order: number, scheduleRevision: number) {
  return {
    ...sharedScheduleData(roundId, draft),
    order,
    scheduleRevision,
    updatedAt: serverTimestamp(),
  };
}

export function publicScheduleData(roundId: string, draft: InterviewScheduleDraft, scheduleRevision: number): Omit<InterviewPublicSchedule, 'id' | 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } {
  const shared = sharedScheduleData(roundId, draft);
  return {
    roundId: shared.roundId,
    surveyOpensAt: shared.surveyOpensAt,
    surveyClosesAt: shared.surveyClosesAt,
    interviewDates: shared.interviewDates,
    dayStartTime: shared.dayStartTime,
    dayEndTime: shared.dayEndTime,
    availabilitySlotMinutes: shared.availabilitySlotMinutes,
    instructions: shared.instructions,
    allowedSlots: shared.allowedSlots,
    daySchedules: shared.daySchedules,
    timeZone: shared.timeZone,
    scheduleRevision,
    active: draft.status !== 'finished',
    schemaVersion: 1,
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
