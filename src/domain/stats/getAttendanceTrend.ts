import { Member, Session } from '../../types';
import { getSemester } from '../semester/getSemester';
import { getActiveMembersAtSemester } from './getSemesterRosterCounts';

export function getAttendanceTrend(
  chronologicalSessions: Session[],
  members: Member[]
) {
  const rosterCounts = new Map<string, number>();

  return chronologicalSessions.map(s => {
    const attendees = new Set<string>();
    s.groups.forEach(g => g.memberIds.forEach(id => attendees.add(id)));
    
    const count = attendees.size;
    const semester = getSemester(s.date);
    const activeCount = rosterCounts.get(semester) ?? getActiveMembersAtSemester(members, semester);
    rosterCounts.set(semester, activeCount);
    const rate = activeCount > 0 ? (count / activeCount) * 100 : 0;
    
    const dateStr = s.date?.toDate ? (s.date.toDate() as Date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '';
    return {
      name: s.name,
      dateStr,
      count,
      rate: Math.round(rate * 10) / 10
    };
  }).filter(d => d.count > 0);
}
