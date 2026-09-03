import { Session, Game, Member } from '../../types';
import { matchesArchiveGameFilters } from './archiveGameFilters';

export function getCorePlayers(
  filteredSessions: Session[],
  games: Game[],
  members: Member[],
  genres: string[],
  difficulties: string[],
  includeBoardMembers: boolean,
  targetGameIds: string[]
) {
  const memberMap = new Map(members.map(member => [member.id, member]));
  const playerGameHits: Record<string, number> = {};

  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      const validGames = g.gameIds
        .map(gId => games.find(x => x.id === gId))
        .filter(game => {
          if (!game) return false;
          if (targetGameIds.length > 0 && !targetGameIds.includes(game.id)) return false;
          return matchesArchiveGameFilters(game, genres, difficulties);
        });

      if (validGames.length > 0) {
        g.memberIds.forEach(mId => {
          const isBoardMember = s.boardMemberIds?.includes(mId) ?? memberMap.get(mId)?.isBoardMember ?? false;
          if (!includeBoardMembers && isBoardMember) return;
          playerGameHits[mId] = (playerGameHits[mId] || 0) + validGames.length;
        });
      }
    });
  });

  return Object.entries(playerGameHits)
    .map(([id, hits]) => {
      const member = memberMap.get(id);
      return { id, hits, member };
    })
    .filter(({ member }) => Boolean(member))
    .sort((a, b) => b.hits - a.hits);
}
