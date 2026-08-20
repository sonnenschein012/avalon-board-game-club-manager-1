import type { InterviewApplicant, InterviewProgressStatus } from '../../types';

export function isActiveInterviewApplicant(applicant: Pick<InterviewApplicant, 'lifecycle' | 'applicationStatus'>) {
  return (applicant.lifecycle ?? 'active') === 'active'
    && (applicant.applicationStatus ?? 'active') === 'active';
}

export function isAssignmentConfirmationCurrent(applicant: Pick<
  InterviewApplicant,
  'assignment' | 'assignmentRevision' | 'confirmationMessage'
>) {
  if (!applicant.assignment || !applicant.confirmationMessage?.lastMarkedSentAt) return false;
  const assignmentRevision = applicant.assignmentRevision ?? applicant.assignment.confirmationRevision ?? 0;
  return assignmentRevision === (applicant.confirmationMessage.assignmentRevision ?? 0);
}

export function getInterviewProgressStatus(applicant: Pick<InterviewApplicant, 'interviewStatus' | 'assignment'>): InterviewProgressStatus {
  if (applicant.interviewStatus) return applicant.interviewStatus;
  const assignmentStatus = applicant.assignment?.status;
  if (assignmentStatus === 'completed') return 'completed';
  if (assignmentStatus === 'change_requested'
    || assignmentStatus === 'no_show'
    || assignmentStatus === 'cancelled'
    || assignmentStatus === 'needs_reschedule') {
    return 'action_needed';
  }
  return 'scheduled';
}

export function canAppearInSchedule(applicant: Pick<InterviewApplicant, 'lifecycle' | 'applicationStatus'>) {
  return isActiveInterviewApplicant(applicant);
}

export function canAppearInInterviewProgress(applicant: Pick<InterviewApplicant, 'lifecycle' | 'applicationStatus' | 'assignment' | 'interviewStatus'>) {
  return isActiveInterviewApplicant(applicant)
    && Boolean(applicant.assignment)
    && getInterviewProgressStatus(applicant) !== 'completed';
}

export function canAppearInSelection(applicant: Pick<InterviewApplicant, 'lifecycle' | 'applicationStatus' | 'assignment' | 'interviewStatus'>) {
  return isActiveInterviewApplicant(applicant)
    && getInterviewProgressStatus(applicant) === 'completed';
}
