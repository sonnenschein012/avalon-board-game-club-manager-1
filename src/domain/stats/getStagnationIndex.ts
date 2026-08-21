import { Session } from '../../types';
import { getSemester } from '../semester/getSemester';

export function getStagnationIndex(chronologicalSessions: Session[], includeYear = false) {
  const cumulativeAttendanceBySemester: Record<string, Record<string, number>> = {};
  const semesterSessionCounts: Record<string, number> = {};
  
  return chronologicalSessions.map((s, idx) => {
    const sDateObj = s.date?.toDate ? (s.date.toDate() as Date) : new Date();
    const semester = getSemester(sDateObj);
    const dateStr = sDateObj.toLocaleDateString('ko-KR', includeYear ? { year: 'numeric', month: '2-digit', day: '2-digit' } : { month: '2-digit', day: '2-digit' });
    
    const attendees = new Set<string>();
    s.groups.forEach(g => g.memberIds.forEach(id => attendees.add(id)));
    
    if (attendees.size === 0) return null;
    
    semesterSessionCounts[semester] = (semesterSessionCounts[semester] || 0) + 1;
    const S_t = semesterSessionCounts[semester];
    const cumulativeAttendance = cumulativeAttendanceBySemester[semester] ?? {};
    cumulativeAttendanceBySemester[semester] = cumulativeAttendance;
    
    let sumLog = 0;
    attendees.forEach(id => {
      cumulativeAttendance[id] = (cumulativeAttendance[id] || 0) + 1;
      const x_i_t = cumulativeAttendance[id];
      const denom = Math.log(S_t + 1);
      if (denom > 0) {
        sumLog += Math.log(x_i_t + 1) / denom;
      }
    });
    
    const stagnationIndex = (1 / attendees.size) * sumLog;
    
    return {
      id: s.id || idx,
      name: s.name,
      dateStr,
      정체성지수: Math.round(stagnationIndex * 1000) / 1000
    };
  }).filter((x): x is NonNullable<typeof x> => Boolean(x));
}
