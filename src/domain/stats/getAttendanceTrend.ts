import { Session } from '../../types';

export function getAttendanceTrend(
  chronologicalSessions: Session[],
  totalActiveStatusMembersCount: number
) {
  return chronologicalSessions.map(s => {
    const attendees = new Set<string>();
    s.groups.forEach(g => g.memberIds.forEach(id => attendees.add(id)));
    
    const count = attendees.size;
    const rate = totalActiveStatusMembersCount > 0 ? (count / totalActiveStatusMembersCount) * 100 : 0;
    
    const dateStr = s.date?.toDate ? (s.date.toDate() as Date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '';
    return {
      name: s.name,
      dateStr,
      count,
      rate: Math.round(rate * 10) / 10
    };
  }).filter(d => d.count > 0 && totalActiveStatusMembersCount > 0);
}
