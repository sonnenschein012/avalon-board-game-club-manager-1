import { describe, expect, it } from 'vitest';
import { generateAutoAssignment, type AutoAssignmentExisting } from './autoAssignment';

const interviewer = (id: string, availability: string[]) => ({ id, name: id, availability });
const existing = (slotId: string, options: Partial<AutoAssignmentExisting> = {}): AutoAssignmentExisting => ({
  slotId, interviewerId: 'i1', interviewerName: 'i1', locked: false, source: 'manual', status: 'scheduled', ...options,
});
const runFor = (applicants: Parameters<typeof generateAutoAssignment>[0]['applicants']) => generateAutoAssignment({
  applicants,
  interviewers: [interviewer('i1', ['2026-08-27|19:00', '2026-08-27|19:30'])],
  availabilitySlotMinutes: 30,
  assignmentSlotMinutes: 30,
  mode: 'applicant',
  applicantId: 'target',
});

describe('V3 per-applicant automatic interview assignment', () => {
  it('uses an empty compatible slot before considering a rearrangement', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] },
      { id: 'tentative', name: '가배정', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00') },
    ]);
    expect(result.proposals.find(item => item.applicantId === 'target')).toMatchObject({ slotId: '2026-08-27|19:30', preserved: false });
    expect(result.proposals.find(item => item.applicantId === 'tentative')).toMatchObject({ slotId: '2026-08-27|19:00', preserved: true });
  });

  it('rearranges only tentative assignments when no empty compatible slot exists', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'tentative', name: '가배정', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], existingAssignment: existing('2026-08-27|19:00') },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.proposals.find(item => item.applicantId === 'target')?.slotId).toBe('2026-08-27|19:00');
    expect(result.proposals.find(item => item.applicantId === 'tentative')).toMatchObject({ slotId: '2026-08-27|19:30', preserved: false });
  });

  it('protects a current confirmation even when the assignment status is only scheduled', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'confirmed', name: '안내완료', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], existingAssignment: existing('2026-08-27|19:00', { confirmationCurrent: true }) },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
    expect(result.proposals.find(item => item.applicantId === 'confirmed')).toMatchObject({ slotId: '2026-08-27|19:00', preserved: true, protected: true });
  });

  it('does not treat an old notice or assignment.status as a current confirmation', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'old-notice', name: '재안내필요', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], existingAssignment: existing('2026-08-27|19:00', { status: 'confirmed', confirmationCurrent: false }) },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.proposals.find(item => item.applicantId === 'old-notice')?.slotId).toBe('2026-08-27|19:30');
  });

  it('excludes withdrawn applicants and does not reserve their old slot', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'withdrawn', name: '철회', availability: ['2026-08-27|19:00'], lifecycle: 'withdrawn', existingAssignment: existing('2026-08-27|19:00', { confirmationCurrent: true }) },
    ]);
    expect(result.failures).toEqual([]);
    expect(result.proposals.find(item => item.applicantId === 'target')?.slotId).toBe('2026-08-27|19:00');
    expect(result.proposals.find(item => item.applicantId === 'withdrawn')).toBeUndefined();
  });

  it('does not reuse a completed interview resource as if it were empty', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'completed', name: '완료자', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00', { status: 'completed' }) },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
    expect(result.proposals.find(item => item.applicantId === 'target')).toBeUndefined();
  });

  it('keeps an action-needed interview out of rearrangement and reserves its resource', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'action', name: '조치필요', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], interviewStatus: 'action_needed', existingAssignment: existing('2026-08-27|19:00') },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
    expect(result.proposals.find(item => item.applicantId === 'action')).toBeUndefined();
  });

  it('excludes a legacy needs-reschedule assignment before matching and keeps its slot reserved', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'legacy', name: '구형 조치필요', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00', { status: 'needs_reschedule' }) },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
    expect(result.proposals.find(item => item.applicantId === 'legacy')).toBeUndefined();
  });

  it('keeps an archived assignment resource reserved until that assignment is explicitly released', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'archived', name: '보관', availability: ['2026-08-27|19:00'], lifecycle: 'archived', existingAssignment: existing('2026-08-27|19:00', { status: 'no_show' }) },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
  });

  it('carries the observed assignment revision into every editable proposal', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:30'], assignmentRevision: 12 },
    ]);
    expect(result.proposals.find(item => item.applicantId === 'target')?.expectedAssignmentRevision).toBe(12);
  });

  it('fails without changing anyone when rearrangement cannot keep every participant assigned', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:00'] },
      { id: 'tentative', name: '가배정', availability: ['2026-08-27|19:00'], existingAssignment: existing('2026-08-27|19:00') },
    ]);
    expect(result.failures.find(item => item.applicantId === 'target')?.reason).toBe('all_candidates_occupied');
    expect(result.proposals.find(item => item.applicantId === 'tentative')).toMatchObject({ slotId: '2026-08-27|19:00', preserved: true });
    expect(result.proposals.find(item => item.applicantId === 'target')).toBeUndefined();
  });

  it('does not move tentative assignments unnecessarily', () => {
    const result = runFor([
      { id: 'target', name: '대상', availability: ['2026-08-27|19:30'] },
      { id: 'tentative', name: '가배정', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], existingAssignment: existing('2026-08-27|19:00') },
    ]);
    expect(result.proposals.find(item => item.applicantId === 'tentative')).toMatchObject({ slotId: '2026-08-27|19:00', preserved: true });
    expect(result.proposals.find(item => item.applicantId === 'target')?.slotId).toBe('2026-08-27|19:30');
  });
});

describe('legacy bulk modes', () => {
  it('balances effective utilization before preserving tentative assignments', () => {
    const slots = ['2026-08-27|19:00', '2026-08-27|19:30', '2026-08-27|20:00', '2026-08-27|20:30'];
    const result = generateAutoAssignment({
      applicants: slots.map((slot, index) => ({ id: `a${index}`, name: `지원자${index}`, availability: slots })),
      interviewers: [interviewer('i1', slots), interviewer('i2', slots)],
      availabilitySlotMinutes: 30, assignmentSlotMinutes: 30, mode: 'all',
    });
    expect(result.assignedCount).toBe(4);
    expect(result.interviewerLoads).toEqual({ i1: 2, i2: 2 });
  });

  it('maximizes assignments and protects the applicant with fewer candidates', () => {
    const result = generateAutoAssignment({
      applicants: [
        { id: 'scarce', name: '좁음', availability: ['2026-08-27|19:00'] },
        { id: 'flexible', name: '넓음', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] },
      ],
      interviewers: [interviewer('i1', ['2026-08-27|19:00', '2026-08-27|19:30'])],
      availabilitySlotMinutes: 30, assignmentSlotMinutes: 30, mode: 'all',
    });
    expect(result.assignedCount).toBe(2);
    expect(result.proposals.find(item => item.applicantId === 'scarce')?.slotId).toBe('2026-08-27|19:00');
    expect(result.proposals.find(item => item.applicantId === 'flexible')?.slotId).toBe('2026-08-27|19:30');
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
