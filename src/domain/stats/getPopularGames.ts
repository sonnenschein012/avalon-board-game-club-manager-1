import { Session, Game } from '../../types';
import { matchesArchiveGameFilters } from './archiveGameFilters';

export function getPopularGames(
  filteredSessions: Session[],
  games: Game[],
  activeMembersCount: number,
  genres: string[],
  difficulties: string[]
) {
  const playCounts: Record<string, number> = {};
  const uniquePlayers: Record<string, Set<string>> = {};

  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      g.gameIds.forEach(gameId => {
        playCounts[gameId] = (playCounts[gameId] || 0) + 1;
        if (!uniquePlayers[gameId]) uniquePlayers[gameId] = new Set();
        g.memberIds.forEach(mId => (uniquePlayers[gameId] as Set<string>).add(mId));
      });
    });
  });

  return Object.entries(playCounts)
    .map(([gameId, count]) => {
      const game = games.find(g => g.id === gameId);
      const uniqueCount = uniquePlayers[gameId]?.size || 0;
      const fixationRaw = activeMembersCount > 0 ? (uniqueCount / activeMembersCount) * 100 : 0;
      const fixation = Math.round(fixationRaw * 10) / 10;
      return { gameId, count, uniqueCount, fixation, game };
    })
    .filter(({ game }) => game && matchesArchiveGameFilters(game, genres, difficulties))
    .sort((a, b) => b.count - a.count);
}
