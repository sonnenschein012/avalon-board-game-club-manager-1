import { describe, expect, it } from 'vitest';
import { getApplicantJourney } from './applicantJourney';

const base = {
  lifecycle: 'active' as const,
  applicationStatus: 'active' as const,
  availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
  confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
  assignment: null,
  assignmentRevision: 0,
  interviewStatus: 'scheduled' as const,
  selectionStatus: 'pending' as const,
};

describe('getApplicantJourney', () => {
  it('shows the first station for a new applicant', () => {
    expect(getApplicantJourney(base)).toMatchObject({ currentIndex: 0, detail: '조사 안내 미발송' });
  });

  it('moves through response and assignment states', () => {
    expect(getApplicantJourney({ ...base, availabilityMessage: { firstMarkedSentAt: {} as never, lastMarkedSentAt: {} as never } })).toMatchObject({ currentIndex: 1 });
    expect(getApplicantJourney({ ...base, access: { submittedAt: {} as never } })).toMatchObject({ currentIndex: 2 });
  });

  it('marks a stale confirmation as requiring resend', () => {
    const assignment = { confirmationRevision: 1 } as never;
    const model = getApplicantJourney({
      ...base,
      assignment,
      assignmentRevision: 2,
      confirmationMessage: { firstMarkedSentAt: {} as never, lastMarkedSentAt: {} as never, assignmentRevision: 1 },
    });
    expect(model).toMatchObject({ currentIndex: 3 });
    expect(model.badges.map(item => item.label)).toContain('확정 재발송 필요');
  });

  it('shows completion and selection separately', () => {
    const model = getApplicantJourney({ ...base, interviewStatus: 'completed', selectionStatus: 'selected' });
    expect(model).toMatchObject({ currentIndex: 4, detail: '면접 완료' });
    expect(model.badges.map(item => item.label)).toContain('선발');
  });
});
