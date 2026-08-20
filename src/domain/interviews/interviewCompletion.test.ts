import { describe, expect, it } from 'vitest';
import type { InterviewApplicant, InterviewNote } from '../../types';
import { prepareInterviewCompletion } from './interviewCompletion';

function assignedApplicant(overrides: Partial<InterviewApplicant> = {}) {
  return {
    roundId: 'round-1',
    lifecycle: 'active',
    applicationStatus: 'active',
    assignment: { interviewerId: 'interviewer-1', interviewerName: '면접관', status: 'scheduled' },
    ...overrides,
  } as InterviewApplicant;
}

describe('prepareInterviewCompletion', () => {
  it('rejects the completion request before producing writes when no rating exists', () => {
    expect(() => prepareInterviewCompletion(assignedApplicant(), null, { roundId: 'round-1' }))
      .toThrow('종합평가를 선택해야');
  });

  it('uses the current screen values for the final atomic completion payload', () => {
    const result = prepareInterviewCompletion(assignedApplicant(), null, {
      roundId: 'round-1',
      overallRating: 'recommend',
      generalNotes: '최신 종합 노트',
      answers: { q1: '최신 답변' },
    });
    expect(result.overallRating).toBe('recommend');
    expect(result.generalNotes).toBe('최신 종합 노트');
    expect(result.answers).toEqual({ q1: '최신 답변' });
    expect(result.completedAssignment.status).toBe('completed');
  });

  it('can finalize an already auto-saved rating without overwriting saved notes', () => {
    const note = {
      overallRating: 'neutral', generalNotes: '저장된 노트', answers: { q1: '저장된 답변' },
      interviewerId: 'interviewer-1', interviewerName: '면접관',
    } as unknown as InterviewNote;
    const result = prepareInterviewCompletion(assignedApplicant(), note, { roundId: 'round-1' });
    expect(result.overallRating).toBe('neutral');
    expect(result.generalNotes).toBe('저장된 노트');
    expect(result.answers).toEqual({ q1: '저장된 답변' });
  });

  it('rejects withdrawn applicants even when a rating exists', () => {
    expect(() => prepareInterviewCompletion(
      assignedApplicant({ applicationStatus: 'withdrawn' }),
      null,
      { roundId: 'round-1', overallRating: 'recommend' },
    )).toThrow('지원 철회');
  });

  it('rejects a stale second completion after another transaction already completed it', () => {
    expect(() => prepareInterviewCompletion(
      assignedApplicant({ interviewStatus: 'completed' }),
      null,
      { roundId: 'round-1', overallRating: 'recommend' },
    )).toThrow('이미 완료');
  });
});
