import { Session, Game, Member } from '../../types';
import { DIFFICULTY_RANGES } from './getPopularGames';

export function getCorePlayers(
  filteredSessions: Session[],
  games: Game[],
  members: Member[],
  w3Genres: string[],
  w3Difficulties: string[],
  w3IncludeBoardMembers: boolean,
  w3TargetGames: string[]
) {
  const memberMap = new Map(members.map(member => [member.id, member]));
  const playerGameHits: Record<string, number> = {};

  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      const validGames = g.gameIds
        .map(gId => games.find(x => x.id === gId))
        .filter(game => {
          if (!game) return false;
          if (w3Genres.length > 0 && !game.genres?.some(gen => w3Genres.includes(gen))) return false;
          if (w3TargetGames.length > 0 && !w3TargetGames.includes(game.id)) return false;
          if (w3Difficulties.length > 0) {
            const diff = game.complexity || 0;
            const diffMatch = w3Difficulties.some(diffLabel => {
              const range = DIFFICULTY_RANGES.find(r => r.label === diffLabel);
              return range ? range.match(diff) : false;
            });
            if (!diffMatch) return false;
          }
          return true;
        });

      if (validGames.length > 0) {
        g.memberIds.forEach(mId => {
          const isBoardMember = s.boardMemberIds?.includes(mId) ?? memberMap.get(mId)?.isBoardMember ?? false;
          if (!w3IncludeBoardMembers && isBoardMember) return;
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
