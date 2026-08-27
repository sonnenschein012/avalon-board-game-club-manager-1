import type { InterviewApplicant, InterviewAssignment } from '../../types';
import { getApplicantAssignmentRevision } from './interviewTransitions';

function assignmentIdentity(assignment: InterviewAssignment | null | undefined) {
  return assignment ? [assignment.slotId, assignment.interviewerId, assignment.status, assignment.locked].join('|') : 'none';
}

export function applyOptimisticAssignment(
  applicant: InterviewApplicant,
  assignment: InterviewAssignment | null,
): InterviewApplicant {
  const nextRevision = getApplicantAssignmentRevision(applicant) + 1;
  const nextAssignment = assignment ? {
    ...assignment,
    scheduleId: applicant.scheduleId ?? null,
    status: 'scheduled' as const,
    confirmationRevision: nextRevision,
  } : null;
  return {
    ...applicant,
    previousAssignment: applicant.assignment ?? null,
    assignment: nextAssignment,
    assignmentRevision: nextRevision,
    ...(nextAssignment ? { interviewStatus: 'scheduled' as const, actionNeededReason: null } : {}),
  };
}

export function rollbackOptimisticApplicant(
  current: InterviewApplicant,
  optimistic: InterviewApplicant,
  previous: InterviewApplicant,
) {
  const stillOptimistic = getApplicantAssignmentRevision(current) === getApplicantAssignmentRevision(optimistic)
    && assignmentIdentity(current.assignment) === assignmentIdentity(optimistic.assignment);
  return stillOptimistic ? previous : current;
}
