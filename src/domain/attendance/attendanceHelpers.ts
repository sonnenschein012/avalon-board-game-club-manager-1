import { Member } from '../../types';

export function calculateGroupAverageAttendance(
  attendeeIds: string[], 
  getMember: (id: string) => Member | undefined,
  memberAttendanceCount: Record<string, number>
) {
  if (attendeeIds.length === 0) return 0;
  const sums = attendeeIds.map(id => {
     const m = getMember(id);
     return m ? (memberAttendanceCount[m.id] || 0) : 0;
  });
  return sums.reduce((a,b)=>a+b, 0) / sums.length;
}

export function calculateGroupAverageStudentId(
  attendeeIds: string[],
  getMember: (id: string) => Member | undefined,
  attendees: { id: string, studentIdPrefix?: string }[]
) {
  if (attendeeIds.length === 0) return 0;
  const prefixes = attendeeIds.map(id => {
     const a = attendees.find(x => x.id === id);
     if (a?.studentIdPrefix) {
         const parsed = parseInt(a.studentIdPrefix, 10);
         if (!isNaN(parsed)) return parsed;
     }
     const m = getMember(id);
     if (m?.studentId) {
         const parsed = parseInt(m.studentId.substring(0, 2), 10);
         if (!isNaN(parsed)) return parsed;
     }
     return 0;
  }).filter(v => v > 0);
  
  if (prefixes.length === 0) return 0;
  return (prefixes.reduce((a,b)=>a+b, 0) / prefixes.length).toFixed(1);
}

export function getReunionWarnings(
  attendeeIds: string[],
  getMember: (id: string) => Member | undefined,
  memberPairRecentCounts: Record<string, number>
) {
  const mems = attendeeIds.map(id => getMember(id)).filter(Boolean) as Member[];
  const warnings: string[] = [];
  for(let i=0; i<mems.length; i++) {
     for(let j=i+1; j<mems.length; j++) {
        const m1 = mems[i];
        const m2 = mems[j];
        if (!m1 || !m2) continue;
        const pairKey = [m1.id, m2.id].sort().join('|');
        if ((memberPairRecentCounts[pairKey] || 0) >= 2) {
            warnings.push(`${m1.name}님과 ${m2.name}`);
        }
     }
  }
  return warnings;
}
