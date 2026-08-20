import { describe, expect, it } from 'vitest';
import type { InterviewApplicant } from '../../types';
import {
  prepareScheduleResetTransition,
  prepareWithdrawalTransition,
} from './interviewTransitions';

function applicant(overrides: Partial<InterviewApplicant> = {}) {
  return {
    lifecycle: 'active',
    applicationStatus: 'active',
    assignmentRevision: 7,
    assignment: { status: 'confirmed', slotId: '2026-09-02|10:00' },
    applicationData: [{ header: '지원동기', value: '원본' }],
    overallRating: 'recommend',
    ...overrides,
  } as InterviewApplicant;
}

describe('Interview V3 transitions', () => {
  it('schedule reset clears only coordination state and invalidates the prior confirmation revision', () => {
    const transition = prepareScheduleResetTransition(applicant());
    expect(transition.nextRevision).toBe(8);
    expect(transition.applicantPatch.assignment).toBeNull();
    expect(transition.accessPatch).toMatchObject({
      availability: [], submittedAt: null, firstAccessedAt: null, assignmentSummary: null,
    });
    expect(transition.applicantPatch).not.toHaveProperty('applicationData');
    expect(transition.applicantPatch).not.toHaveProperty('overallRating');
  });

  it('schedule reset does not erase an already completed interview state or evaluation', () => {
    const transition = prepareScheduleResetTransition(applicant({ interviewStatus: 'completed' }));
    expect(transition.applicantPatch.interviewStatus).toBe('completed');
    expect(transition.applicantPatch).not.toHaveProperty('overallRating');
  });

  it('preserves completion for compatible V2 records without interviewStatus', () => {
    const transition = prepareScheduleResetTransition(applicant({
      assignment: { status: 'completed', slotId: '2026-09-02|10:00' } as InterviewApplicant['assignment'],
    }));
    expect(transition.applicantPatch.interviewStatus).toBe('completed');
  });

  it('rejects schedule reset while withdrawn so the retained availability cannot be erased', () => {
    expect(() => prepareScheduleResetTransition(applicant({ applicationStatus: 'withdrawn' }))).toThrow('지원 철회');
  });

  it('withdrawal releases an active assignment without deleting availability, and restoration does not restore it', () => {
    const withdrawn = prepareWithdrawalTransition(applicant(), true);
    expect(withdrawn.applicantPatch.assignment).toBeNull();
    expect(withdrawn.nextRevision).toBe(8);
    expect(withdrawn.accessPatch).not.toHaveProperty('availability');
    const restored = prepareWithdrawalTransition(applicant({ assignment: null, assignmentRevision: 8 }), false);
    expect(restored.applicantPatch).not.toHaveProperty('assignment');
    expect(restored.accessPatch.active).toBe(true);
  });

  it('withdrawal also releases an exceptional non-completed assignment', () => {
    const withdrawn = prepareWithdrawalTransition(applicant({
      assignment: { status: 'no_show', slotId: '2026-09-02|10:00' } as InterviewApplicant['assignment'],
    }), true);
    expect(withdrawn.applicantPatch.assignment).toBeNull();
    expect(withdrawn.activeAssignment?.status).toBe('no_show');
  });

});
