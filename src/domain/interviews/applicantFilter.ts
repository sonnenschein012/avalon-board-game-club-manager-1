import { getApplicantAssignmentRevision } from './interviewTransitions';
import type { InterviewApplicantWithAccess } from '../../types';
import { getInterviewProgressStatus } from './interviewPolicy';

export type InterviewApplicantFilter =
  | 'all'
  | 'responded'
  | 'pending'
  | 'assigned'
  | 'unassigned'
  | 'schedule-unassigned'
  | 'schedule-pending'
  | 'assignment-pending'
  | 'completed'
  | 'action-needed'
  | 'availability-unsent'
  | 'availability-sent'
  | 'availability-sent-pending'
  | 'confirmation-unsent'
  | 'confirmation-sent'
  | 'withdrawn'
  | 'archived';

export function filterInterviewApplicants(applicants: InterviewApplicantWithAccess[], filter: InterviewApplicantFilter, search: string) {
  const q = search.trim().toLowerCase();
  return applicants.filter(applicant => {
    if (q && !`${applicant.applicantNumber} ${applicant.name} ${applicant.phone}`.toLowerCase().includes(q)) return false;
    const lifecycle = applicant.lifecycle ?? 'active';
    if (filter === 'archived') return lifecycle === 'archived';
    if (lifecycle === 'archived') return false;
    const applicationStatus = applicant.applicationStatus ?? 'active';
    if (filter === 'withdrawn') return applicationStatus === 'withdrawn';
    if (applicationStatus === 'withdrawn') return false;
    const responded = Boolean(applicant.access?.submittedAt);
    const availabilitySent = Boolean(applicant.availabilityMessage.firstMarkedSentAt);
    const confirmationSent = Boolean(applicant.confirmationMessage.firstMarkedSentAt);
    if (filter === 'responded') return responded;
    if (filter === 'pending') return !responded;
    if (filter === 'assigned') return Boolean(applicant.assignment);
    if (filter === 'unassigned') return !applicant.assignment;
    if (filter === 'schedule-unassigned') return applicant.scheduleId === null;
    if (filter === 'schedule-pending') return applicant.scheduleId != null && !responded;
    if (filter === 'assignment-pending') return applicant.scheduleId != null && responded && !applicant.assignment && getInterviewProgressStatus(applicant) === 'scheduled';
    if (filter === 'completed') return getInterviewProgressStatus(applicant) === 'completed';
    if (filter === 'action-needed') return getInterviewProgressStatus(applicant) === 'action_needed';
    if (filter === 'availability-unsent') return !availabilitySent;
    if (filter === 'availability-sent') return availabilitySent;
    if (filter === 'availability-sent-pending') return availabilitySent && !responded;
    const confirmationMatchesAssignment = Boolean(applicant.assignment) && confirmationSent
      && getApplicantAssignmentRevision(applicant) === (applicant.confirmationMessage.assignmentRevision ?? 0);
    if (filter === 'confirmation-unsent') return Boolean(applicant.assignment) && !confirmationMatchesAssignment;
    if (filter === 'confirmation-sent') return confirmationMatchesAssignment;
    return true;
  });
}
