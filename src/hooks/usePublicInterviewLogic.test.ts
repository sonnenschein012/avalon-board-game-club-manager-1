import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { InterviewAccess, InterviewPublicRound } from '../types';
import { getPublicInterviewState, resolvePublicInitializationState } from './usePublicInterviewLogic';

function access(active = true): InterviewAccess {
  return { active } as InterviewAccess;
}

function round(status: InterviewPublicRound['status'], opensAt: Date, closesAt: Date): InterviewPublicRound {
  return {
    active: true,
    status,
    surveyOpensAt: Timestamp.fromDate(opensAt),
    surveyClosesAt: Timestamp.fromDate(closesAt),
  } as InterviewPublicRound;
}

describe('getPublicInterviewState', () => {
  const now = new Date('2026-08-13T06:00:00.000Z');

  it('기존 초안 상태라도 설정한 조사 기간 안이면 응답을 허용한다', () => {
    expect(getPublicInterviewState(
      access(),
      round('draft', new Date('2026-08-13T05:00:00.000Z'), new Date('2026-09-13T06:00:00.000Z')),
      now,
    )).toBe('collecting');
  });

  it('상태값과 무관하게 시작 전과 마감 후를 자동 판정한다', () => {
    expect(getPublicInterviewState(
      access(),
      round('collecting', new Date('2026-08-13T07:00:00.000Z'), new Date('2026-09-13T06:00:00.000Z')),
      now,
    )).toBe('before');
    expect(getPublicInterviewState(
      access(),
      round('draft', new Date('2026-07-13T06:00:00.000Z'), new Date('2026-08-13T06:00:00.000Z')),
      now,
    )).toBe('closed');
  });

  it('면접이 완료되면 조사 기간과 무관하게 개인 링크의 기능을 닫는다', () => {
    const completedAccess = {
      ...access(),
      assignmentSummary: { status: 'completed' },
    } as InterviewAccess;

    expect(getPublicInterviewState(
      completedAccess,
      round('collecting', new Date('2026-08-13T05:00:00.000Z'), new Date('2026-09-13T06:00:00.000Z')),
      now,
    )).toBe('completed');
  });

  it('아직 면접 일정에 지정되지 않은 새 지원자의 링크는 입력을 열지 않는다', () => {
    const unassignedAccess = { ...access(), scheduleId: null } as InterviewAccess;
    expect(getPublicInterviewState(
      unassignedAccess,
      round('collecting', new Date('2026-08-13T05:00:00.000Z'), new Date('2026-09-13T06:00:00.000Z')),
      now,
    )).toBe('unassigned');
  });
});

describe('resolvePublicInitializationState', () => {
  it('고정 일정 링크는 최초 접속 기록 중에도 응답 화면을 연다', () => {
    expect(resolvePublicInitializationState('collecting', true, 'schedule-1', null)).toBe('collecting');
  });

  it('구형 이동 범위 링크는 최초 접속 기록 전까지 차단하고 지연 오류를 표시한다', () => {
    expect(resolvePublicInitializationState('collecting', true, undefined, null)).toBe('loading');
    expect(resolvePublicInitializationState('collecting', true, undefined, '지연')).toBe('error');
  });
});
