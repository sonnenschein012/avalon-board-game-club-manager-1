import { Session, Member } from '../../types';

export function getAttendanceRanking(
  filteredSessions: Session[],
  members: Member[],
  includeBoardMembers: boolean
) {
  const counts: Record<string, number> = {};
  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      g.memberIds.forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
  });

  return Object.entries(counts)
    .map(([id, count]) => {
      const member = members.find(m => m.id === id);
      return { id, count, member };
    })
    .filter(({ member }) => member && (includeBoardMembers || !member.isBoardMember))
    .sort((a, b) => b.count - a.count);
}
