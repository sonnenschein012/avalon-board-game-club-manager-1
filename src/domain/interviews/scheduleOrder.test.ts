import { describe, expect, it } from 'vitest';
import { compareInterviewSchedules, getInterviewScheduleEndDate, getInterviewScheduleStartDate, getRecommendedInterviewScheduleId } from './scheduleOrder';

const schedule = (name: string, interviewDates: string[], order: number) => ({ name, interviewDates, order });

describe('interview schedule order', () => {
  it('면접 기간의 시작 날짜를 기준으로 오름차순 정렬한다', () => {
    const schedules = [
      schedule('셋째', ['2026-09-10', '2026-09-11'], 1),
      schedule('첫째', ['2026-09-01', '2026-09-03'], 3),
      schedule('둘째', ['2026-09-05', '2026-09-06'], 2),
    ];

    expect(schedules.sort(compareInterviewSchedules).map(item => item.name)).toEqual(['첫째', '둘째', '셋째']);
  });

  it('날짜가 같으면 생성 순서를 사용하고 날짜가 없는 일정은 마지막에 둔다', () => {
    const schedules = [
      schedule('날짜 없음', [], 1),
      schedule('나중 생성', ['2026-09-01'], 3),
      schedule('먼저 생성', ['2026-09-01'], 2),
    ];

    expect(schedules.sort(compareInterviewSchedules).map(item => item.name)).toEqual(['먼저 생성', '나중 생성', '날짜 없음']);
  });

  it('저장 순서와 관계없이 기간의 시작일과 종료일을 구한다', () => {
    const item = schedule('일정', ['2026-09-03', '2026-09-01', '2026-09-02'], 1);
    expect(getInterviewScheduleStartDate(item)).toBe('2026-09-01');
    expect(getInterviewScheduleEndDate(item)).toBe('2026-09-03');
  });

  it('모레 시작 일정을 가장 먼저 추천한다', () => {
    const schedules = [
      { ...schedule('내일', ['2026-09-01'], 1), id: 'tomorrow', status: 'collecting' as const },
      { ...schedule('모레', ['2026-09-02'], 2), id: 'preferred', status: 'collecting' as const },
      { ...schedule('3일 후', ['2026-09-03'], 3), id: 'three-days', status: 'collecting' as const },
    ];

    expect(getRecommendedInterviewScheduleId(schedules, new Date('2026-08-31T03:00:00Z'))).toBe('preferred');
  });

  it('모레 일정이 없고 내일과 3일 후가 있으면 더 이른 내일 일정을 추천한다', () => {
    const schedules = [
      { ...schedule('3일 후', ['2026-09-03'], 2), id: 'three-days', status: 'collecting' as const },
      { ...schedule('내일', ['2026-09-01'], 1), id: 'tomorrow', status: 'collecting' as const },
    ];

    expect(getRecommendedInterviewScheduleId(schedules, new Date('2026-08-31T03:00:00Z'))).toBe('tomorrow');
  });

  it('오늘·지난 일정·보관 일정은 추천하지 않는다', () => {
    const schedules = [
      { ...schedule('오늘', ['2026-08-31'], 1), id: 'today', status: 'collecting' as const },
      { ...schedule('어제', ['2026-08-30'], 2), id: 'past', status: 'collecting' as const },
      { ...schedule('모레 보관', ['2026-09-02'], 3), id: 'archived', status: 'archived' as const },
    ];

    expect(getRecommendedInterviewScheduleId(schedules, new Date('2026-08-31T03:00:00Z'))).toBe('');
  });
});
