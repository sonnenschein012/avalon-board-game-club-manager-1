import { describe, expect, it } from 'vitest';
import { generateAutoAssignment, type AutoAssignmentExisting } from './autoAssignment';

const interviewer = (id: string, availability: string[]) => ({ id, name: id, availability });
const existing = (slotId: string, locked = false): AutoAssignmentExisting => ({
  slotId, interviewerId: 'i1', interviewerName: 'i1', locked, source: 'manual', status: 'scheduled',
});

describe('automatic interview assignment', () => {
  it('maximizes assignments and protects the applicant with fewer candidates', () => {
    const result = generateAutoAssignment({
      applicants: [
        { id: 'scarce', name: '좁음', availability: ['2026-08-27|19:00'] },
        { id: 'flexible', name: '넓음', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] },
      ],
      interviewers: [interviewer('i1', ['2026-08-27|19:00', '2026-08-27|19:30'])],
      availabilitySlotMinutes: 30,
      assignmentSlotMinutes: 30,
      mode: 'all',
    });
    expect(result.assignedCount).toBe(2);
    expect(result.proposals.find(item => item.applicantId === 'scarce')?.slotId).toBe('2026-08-27|19:00');
    expect(result.proposals.find(item => item.applicantId === 'flexible')?.slotId).toBe('2026-08-27|19:30');
  });

  it('treats the same time with different individual interviewers as different resources', () => {
    const result = generateAutoAssignment({
      applicants: [{ id: 'a', name: 'A', availability: ['2026-08-27|19:00'] }, { id: 'b', name: 'B', availability: ['2026-08-27|19:00'] }],
      interviewers: [interviewer('i1', ['2026-08-27|19:00']), interviewer('i2', ['2026-08-27|19:00'])],
      availabilitySlotMinutes: 30, assignmentSlotMinutes: 30, mode: 'all',
    });
    expect(result.assignedCount).toBe(2);
    expect(new Set(result.proposals.map(item => item.interviewerId)).size).toBe(2);
  });

  it('preserves locked assignments and leaves no-show records out of automatic reassignment', () => {
    const result = generateAutoAssignment({
      applicants: [
        { id: 'locked', name: '잠금', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00', true) },
        { id: 'other', name: '다른', availability: ['2026-08-27|19:00'] },
        { id: 'no-show', name: '불참', availability: ['2026-08-27|19:30'], existingAssignment: { ...existing('2026-08-27|19:30'), status: 'no_show' } },
      ],
      interviewers: [interviewer('i1', ['2026-08-27|19:00', '2026-08-27|19:30'])],
      availabilitySlotMinutes: 30, assignmentSlotMinutes: 30, mode: 'all',
    });
    expect(result.proposals.find(item => item.applicantId === 'locked')).toMatchObject({ slotId: '2026-08-27|19:00', locked: true, preserved: true });
    expect(result.failures.find(item => item.applicantId === 'no-show')?.reason).toBe('excluded_state');
    expect(result.failures.find(item => item.applicantId === 'other')?.reason).toBe('all_candidates_occupied');
  });

  it('keeps all existing assignments fixed in unassigned-only mode', () => {
    const result = generateAutoAssignment({
      applicants: [
        { id: 'fixed', name: '기존', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00') },
        { id: 'new', name: '미배정', availability: ['2026-08-27|19:30'] },
      ],
      interviewers: [interviewer('i1', ['2026-08-27|19:00', '2026-08-27|19:30'])],
      availabilitySlotMinutes: 30, assignmentSlotMinutes: 30, mode: 'unassigned',
    });
    expect(result.proposals.find(item => item.applicantId === 'fixed')?.preserved).toBe(true);
    expect(result.proposals.find(item => item.applicantId === 'new')?.slotId).toBe('2026-08-27|19:30');
  });
});
