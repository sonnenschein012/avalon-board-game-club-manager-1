import { Session, Member } from '../../types';

export function getAttendanceRanking(
  filteredSessions: Session[],
  members: Member[],
  includeBoardMembers: boolean
) {
  const memberMap = new Map(members.map(member => [member.id, member]));
  const counts: Record<string, number> = {};
  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      g.memberIds.forEach(id => {
        const isBoardMember = s.boardMemberIds?.includes(id) ?? memberMap.get(id)?.isBoardMember ?? false;
        if (!includeBoardMembers && isBoardMember) return;
        counts[id] = (counts[id] || 0) + 1;
      });
    });
  });

  return Object.entries(counts)
    .map(([id, count]) => {
      const member = memberMap.get(id);
      return { id, count, member };
    })
    .filter(({ member }) => Boolean(member))
    .sort((a, b) => b.count - a.count);
}
