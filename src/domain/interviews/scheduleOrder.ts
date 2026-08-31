import type { InterviewSchedule } from '../../types';

export function getInterviewScheduleStartDate(schedule: Pick<InterviewSchedule, 'interviewDates'>): string | null {
  return schedule.interviewDates.length > 0
    ? schedule.interviewDates.reduce((earliest, date) => date < earliest ? date : earliest)
    : null;
}

export function getInterviewScheduleEndDate(schedule: Pick<InterviewSchedule, 'interviewDates'>): string | null {
  return schedule.interviewDates.length > 0
    ? schedule.interviewDates.reduce((latest, date) => date > latest ? date : latest)
    : null;
}

export function compareInterviewSchedules(
  left: Pick<InterviewSchedule, 'interviewDates' | 'order' | 'name'>,
  right: Pick<InterviewSchedule, 'interviewDates' | 'order' | 'name'>,
): number {
  const leftStart = getInterviewScheduleStartDate(left);
  const rightStart = getInterviewScheduleStartDate(right);
  if (leftStart && rightStart) {
    const byStartDate = leftStart.localeCompare(rightStart);
    if (byStartDate !== 0) return byStartDate;
  } else if (leftStart) {
    return -1;
  } else if (rightStart) {
    return 1;
  }
  return left.order - right.order || left.name.localeCompare(right.name, 'ko-KR');
}

function koreaDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKeyDistance(left: string, right: string): number {
  return Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`));
}

export function getRecommendedInterviewScheduleId(
  schedules: ReadonlyArray<Pick<InterviewSchedule, 'id' | 'status' | 'interviewDates'>>,
  now = new Date(),
): string {
  const today = koreaDateKey(now);
  const preferredDate = addDateKeyDays(today, 2);
  return schedules
    .flatMap(schedule => {
      const startDate = getInterviewScheduleStartDate(schedule);
      return schedule.status !== 'archived' && startDate && startDate > today
        ? [{ id: schedule.id, startDate }]
        : [];
    })
    .sort((left, right) => (
      dateKeyDistance(left.startDate, preferredDate) - dateKeyDistance(right.startDate, preferredDate)
      || left.startDate.localeCompare(right.startDate)
    ))[0]?.id ?? '';
}
