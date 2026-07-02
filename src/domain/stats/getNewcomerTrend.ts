import { Session, Member } from '../../types';
import { getSemester } from '../semester/getSemester';

export function getNewcomerTrend(
  chronologicalSessions: Session[],
  activeMemberIds: Set<string>,
  members: Member[],
  w5Normalize: boolean
) {
  const activeMembersInfos = Array.from(activeMemberIds).map(id => members.find(m => m.id === id)).filter(Boolean);
  
  return chronologicalSessions.map((s, idx) => {
    const sDateObj = s.date?.toDate ? (s.date.toDate() as Date) : new Date();
    const sSemester = getSemester(sDateObj);
    const dateStr = sDateObj.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    
    const attendees = new Set<string>();
    s.groups.forEach(g => g.memberIds.forEach(id => attendees.add(id)));
    
    if (attendees.size < 3) return null;
    
    let newbieCount = 0;
    
    attendees.forEach(id => {
      const m = members.find(x => x.id === id);
      if (m?.semester === sSemester) newbieCount++;
    });
    
    const totalSessionAttendees = attendees.size;
    const existingCount = totalSessionAttendees - newbieCount;
    const dailyNewbieRate = newbieCount / totalSessionAttendees;
    
    if (w5Normalize) {
      const totalActiveNewbiesScope = activeMembersInfos.filter(m => m?.semester === sSemester).length;
      const totalActiveMembersScope = activeMembersInfos.length;
      
      const globalNewbieRate = totalActiveMembersScope > 0 ? (totalActiveNewbiesScope / totalActiveMembersScope) : 0;
      
      let normalizedRate = 0;
      if (globalNewbieRate > 0) {
        normalizedRate = dailyNewbieRate / globalNewbieRate;
      }
      
      return {
        id: s.id || idx,
        name: s.name,
        dateStr,
        보정지수: Math.round(normalizedRate * 100) / 100,
      };
    } else {
      return {
        id: s.id || idx,
        name: s.name,
        dateStr,
        신입: Math.round(dailyNewbieRate * 100),
        기존: Math.round((existingCount / totalSessionAttendees) * 100)
      };
    }
  }).filter((x): x is NonNullable<typeof x> => Boolean(x));
}
