import type { InterviewAccess, InterviewApplicant, InterviewAssignment } from '../../types';

export function getApplicantAssignmentRevision(applicant: Pick<InterviewApplicant, 'assignment' | 'assignmentRevision'>) {
  return applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0;
}

export function prepareScheduleResetTransition(applicant: InterviewApplicant) {
  if ((applicant.applicationStatus ?? 'active') === 'withdrawn' || (applicant.lifecycle ?? 'active') === 'archived') {
    throw new Error('지원 철회 또는 보관 상태에서는 일정을 초기화할 수 없습니다.');
  }
  const previousAssignment = applicant.assignment ?? null;
  const previousRevision = getApplicantAssignmentRevision(applicant);
  const nextRevision = previousRevision + 1;
  return {
    previousAssignment,
    previousRevision,
    nextRevision,
    applicantPatch: {
      assignment: null,
      previousAssignment,
      assignmentRevision: nextRevision,
      interviewStatus: applicant.interviewStatus === 'completed' || applicant.assignment?.status === 'completed'
        ? 'completed' as const
        : 'scheduled' as const,
      actionNeededReason: null,
    },
    accessPatch: {
      availability: [] as string[],
      submittedAt: null,
      updatedAt: null,
      responseUpdatedAt: null,
      firstAccessedAt: null,
      assignmentSummary: null,
    },
  };
}

function isActiveAssignment(assignment: InterviewAssignment | null) {
  return Boolean(assignment && assignment.status !== 'completed');
}

export function prepareWithdrawalTransition(applicant: InterviewApplicant, withdrawn: boolean) {
  const activeAssignment = isActiveAssignment(applicant.assignment) ? applicant.assignment : null;
  const previousRevision = getApplicantAssignmentRevision(applicant);
  const nextRevision = withdrawn && activeAssignment ? previousRevision + 1 : previousRevision;
  return {
    activeAssignment,
    previousRevision,
    nextRevision,
    applicantPatch: {
      applicationStatus: withdrawn ? 'withdrawn' as const : 'active' as const,
      ...(withdrawn && activeAssignment ? {
        assignment: null,
        previousAssignment: activeAssignment,
        assignmentRevision: nextRevision,
      } : {}),
    },
    accessPatch: {
      active: !withdrawn && (applicant.lifecycle ?? 'active') === 'active',
      ...(withdrawn && activeAssignment ? { assignmentSummary: null } : {}),
    },
  };
}

export function prepareReissuedAccess(
  previousAccess: InterviewAccess,
  previousToken: string,
  active: boolean,
) {
  return {
    ...previousAccess,
    active,
    tokenRevision: (previousAccess.tokenRevision ?? 1) + 1,
    supersededBy: null,
    supersededAt: null,
    reissuedFrom: previousToken,
  };
}
