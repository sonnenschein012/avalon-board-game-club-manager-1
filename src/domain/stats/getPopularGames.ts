import { Session, Game } from '../../types';

export const DIFFICULTY_RANGES = [
  { label: '1점대', match: (c: number) => c >= 1 && c < 2 },
  { label: '2점대', match: (c: number) => c >= 2 && c < 3 },
  { label: '3점대', match: (c: number) => c >= 3 && c < 4 },
  { label: '4점대 이상', match: (c: number) => c >= 4 }
];

export function getPopularGames(
  filteredSessions: Session[],
  games: Game[],
  activeMembersCount: number,
  w2Genres: string[],
  w2Difficulties: string[]
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

  let result = Object.entries(playCounts)
    .map(([gameId, count]) => {
      const game = games.find(g => g.id === gameId);
      const uniqueCount = uniquePlayers[gameId]?.size || 0;
      const fixationRaw = activeMembersCount > 0 ? (uniqueCount / activeMembersCount) * 100 : 0;
      const fixation = Math.round(fixationRaw * 10) / 10;
      return { gameId, count, uniqueCount, fixation, game };
    })
    .filter(x => x.game);

  if (w2Genres.length > 0) {
    result = result.filter(x => x.game?.genres?.some(g => w2Genres.includes(g)));
  }
  if (w2Difficulties.length > 0) {
    result = result.filter(x => {
      const diff = x.game?.complexity || 0;
      return w2Difficulties.some(diffLabel => {
        const range = DIFFICULTY_RANGES.find(r => r.label === diffLabel);
        return range ? range.match(diff) : false;
      });
    });
  }

  return result.sort((a, b) => b.count - a.count);
}
