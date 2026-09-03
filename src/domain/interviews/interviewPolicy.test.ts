import { describe, expect, it } from 'vitest';
import type { InterviewApplicant } from '../../types';
import {
  canAppearInInterviewProgress,
  canAppearInSchedule,
  canAppearInSelection,
  getInterviewProgressStatus,
  isAssignmentConfirmationCurrent,
} from './interviewPolicy';

function applicant(overrides: Partial<InterviewApplicant> = {}) {
  return {
    lifecycle: 'active',
    applicationStatus: 'active',
    assignment: null,
    confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
    ...overrides,
  } as InterviewApplicant;
}

describe('interview policy', () => {
  it('protects only a confirmation for the current assignment revision', () => {
    const assignment = { confirmationRevision: 3 } as InterviewApplicant['assignment'];
    const sent = {} as NonNullable<InterviewApplicant['confirmationMessage']['lastMarkedSentAt']>;
    expect(isAssignmentConfirmationCurrent(applicant({
      assignment,
      assignmentRevision: 3,
      confirmationMessage: { firstMarkedSentAt: sent, lastMarkedSentAt: sent, assignmentRevision: 3 },
    }))).toBe(true);
    expect(isAssignmentConfirmationCurrent(applicant({
      assignment,
      assignmentRevision: 4,
      confirmationMessage: { firstMarkedSentAt: sent, lastMarkedSentAt: sent, assignmentRevision: 3 },
    }))).toBe(false);
  });

  it('excludes withdrawn applicants from schedule, progress, and selection', () => {
    const withdrawn = applicant({
      applicationStatus: 'withdrawn',
      assignment: { status: 'completed' } as InterviewApplicant['assignment'],
      interviewStatus: 'completed',
    });
    expect(canAppearInSchedule(withdrawn)).toBe(false);
    expect(canAppearInInterviewProgress(withdrawn)).toBe(false);
    expect(canAppearInSelection(withdrawn)).toBe(false);
  });

  it('keeps action-needed applicants in schedule but hides completed or decided applicants', () => {
    const scheduled = applicant({ interviewStatus: 'scheduled', selectionStatus: 'pending' });
    expect(canAppearInSchedule(scheduled)).toBe(true);
    expect(canAppearInSchedule(applicant({ interviewStatus: 'action_needed', selectionStatus: 'pending' }))).toBe(true);
    expect(canAppearInSchedule(applicant({ interviewStatus: 'completed', selectionStatus: 'pending' }))).toBe(false);
    expect(canAppearInSchedule(applicant({ interviewStatus: 'scheduled', selectionStatus: 'selected' }))).toBe(false);
  });

  it('keeps action-needed interviews out of the normal selection population', () => {
    const actionNeeded = applicant({
      assignment: { status: 'scheduled' } as InterviewApplicant['assignment'],
      interviewStatus: 'action_needed',
    });
    expect(canAppearInInterviewProgress(actionNeeded)).toBe(true);
    expect(canAppearInSelection(actionNeeded)).toBe(false);
  });

  it('shows only completed interviews in selection, including legacy assignment-status records', () => {
    const completed = applicant({
      assignment: { status: 'completed' } as InterviewApplicant['assignment'],
    });
    expect(getInterviewProgressStatus(completed)).toBe('completed');
    expect(canAppearInSelection(completed)).toBe(true);
    expect(canAppearInInterviewProgress(completed)).toBe(false);
  });

  it.each(['change_requested', 'no_show', 'cancelled', 'needs_reschedule'] as const)(
    'normalizes legacy %s assignments to action-needed',
    status => {
      const legacy = applicant({ assignment: { status } as InterviewApplicant['assignment'] });
      expect(getInterviewProgressStatus(legacy)).toBe('action_needed');
      expect(canAppearInSelection(legacy)).toBe(false);
      expect(canAppearInInterviewProgress(legacy)).toBe(true);
    },
  );
});
