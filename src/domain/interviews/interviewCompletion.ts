import type { InterviewApplicant, InterviewNote, InterviewOverallRating } from '../../types';
import { getInterviewProgressStatus, isActiveInterviewApplicant } from './interviewV3Policy';

const OVERALL_RATINGS: InterviewOverallRating[] = [
  'strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'strongly_not_recommend',
];

export interface InterviewCompletionDraft {
  roundId: string;
  interviewerId?: string;
  interviewerName?: string;
  generalNotes?: string;
  answers?: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
}

export function prepareInterviewCompletion(
  applicant: InterviewApplicant,
  existingNote: InterviewNote | null,
  draft: InterviewCompletionDraft,
) {
  if (applicant.roundId !== draft.roundId) throw new Error('다른 면접 회차의 지원자입니다.');
  if (!isActiveInterviewApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 완료 처리할 수 없습니다.');
  if (getInterviewProgressStatus(applicant) === 'completed') throw new Error('이미 완료된 면접입니다.');
  if (!applicant.assignment) throw new Error('면접 배정이 없어 완료 처리할 수 없습니다.');
  const overallRating = draft.overallRating ?? existingNote?.overallRating ?? null;
  if (!overallRating || !OVERALL_RATINGS.includes(overallRating)) {
    throw new Error('종합평가를 선택해야 면접을 완료할 수 있습니다.');
  }
  return {
    overallRating,
    interviewerId: draft.interviewerId || existingNote?.interviewerId || applicant.assignment.interviewerId,
    interviewerName: draft.interviewerName || existingNote?.interviewerName || applicant.assignment.interviewerName,
    generalNotes: draft.generalNotes ?? existingNote?.generalNotes ?? '',
    answers: draft.answers ?? existingNote?.answers ?? {},
    completedAssignment: { ...applicant.assignment, status: 'completed' as const },
  };
}

/**
 * Builds the reversible state change used when an administrator reopens an
 * interview that was marked complete by mistake. Notes and the rating are
 * intentionally not part of this result: they remain historical interview
 * evidence and must not be erased as a side effect of reopening.
 */
export function prepareInterviewReopen(applicant: InterviewApplicant, confirmationIsCurrent: boolean) {
  if (!isActiveInterviewApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 완료를 취소할 수 없습니다.');
  if (getInterviewProgressStatus(applicant) !== 'completed') throw new Error('완료된 면접만 취소할 수 있습니다.');
  if (!applicant.assignment) throw new Error('현재 면접 배정이 없어 완료를 취소할 수 없습니다.');
  return {
    reopenedAssignment: {
      ...applicant.assignment,
      status: confirmationIsCurrent ? 'confirmed' as const : 'scheduled' as const,
    },
  };
}

export { OVERALL_RATINGS };
