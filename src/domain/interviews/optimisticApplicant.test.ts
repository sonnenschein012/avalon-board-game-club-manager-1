import { describe, expect, it } from 'vitest';
import type { InterviewApplicant, InterviewAssignment } from '../../types';
import { applyOptimisticAssignment, rollbackOptimisticApplicant } from './optimisticApplicant';

const applicant = (revision: number, assignment: InterviewAssignment | null = null) => ({
  id: 'applicant-1',
  scheduleId: 'schedule-1',
  assignmentRevision: revision,
  assignment,
} as InterviewApplicant);

const assignment = (slotId: string) => ({
  slotId,
  interviewerId: 'interviewer-1',
  interviewerName: '면접관',
  status: 'scheduled',
  locked: true,
} as InterviewAssignment);

describe('optimistic applicant updates', () => {
  it('배정을 즉시 반영하면서 리비전을 한 단계 올린다', () => {
    const next = applyOptimisticAssignment(applicant(3), assignment('slot-1'));
    expect(next.assignmentRevision).toBe(4);
    expect(next.assignment?.confirmationRevision).toBe(4);
    expect(next.assignment?.scheduleId).toBe('schedule-1');
  });

  it('실패 시 아직 같은 낙관 상태일 때만 원본으로 되돌린다', () => {
    const previous = applicant(3);
    const optimistic = applyOptimisticAssignment(previous, assignment('slot-1'));
    expect(rollbackOptimisticApplicant(optimistic, optimistic, previous)).toBe(previous);

    const newerRemote = applyOptimisticAssignment(optimistic, assignment('slot-2'));
    expect(rollbackOptimisticApplicant(newerRemote, optimistic, previous)).toBe(newerRemote);
  });
});
