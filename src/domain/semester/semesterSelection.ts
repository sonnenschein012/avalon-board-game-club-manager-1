import { getSemester } from './getSemester';

export function getAvailableArchiveSemesters(sessionDates: Array<unknown>, now = new Date()) {
  const semesters = new Set<string>([getSemester(now)]);
  sessionDates.forEach(date => {
    const semester = getSemester(date as Date);
    if (semester !== '알 수 없음') semesters.add(semester);
  });
  return ['전체', ...[...semesters].sort().reverse()];
}
