import { Session, Game } from '../../types';

export function getGameMmi(
  filteredSessions: Session[],
  activeMembersCount: number,
  games: Game[]
) {
  const gamePlayCounts: Record<string, number> = {};
  const gameSeats: Record<string, number> = {};
  const gameUniquePlayers: Record<string, Set<string>> = {};
  
  filteredSessions.forEach(s => {
    s.groups.forEach(g => {
      g.gameIds.forEach(gameId => {
        gamePlayCounts[gameId] = (gamePlayCounts[gameId] || 0) + 1;
        
        gameSeats[gameId] = (gameSeats[gameId] || 0) + g.memberIds.length;
        
        if (!gameUniquePlayers[gameId]) gameUniquePlayers[gameId] = new Set();
        g.memberIds.forEach(id => (gameUniquePlayers[gameId] as Set<string>).add(id));
      });
    });
  });
  
  const N = activeMembersCount;
  if (N === 0) return [];
  
  return Object.keys(gamePlayCounts)
    .filter(gameId => (gamePlayCounts[gameId] || 0) >= 2) // 2회 이상 플레이
    .map(gameId => {
      const game = games.find(g => g.id === gameId);
      const n = (gameUniquePlayers[gameId] || new Set()).size;
      const T = gameSeats[gameId] || 0;
      
      let mmi = 0;
      if (n > 0) {
        mmi = (1 / Math.pow(n, 2)) * (1 - (n / N)) * Math.log(T + 1);
      }
      
      return {
        gameId,
        game,
        mmi: Math.round(mmi * 1000) / 1000
      };
    })
    .filter(x => x.game && x.mmi > 0)
    .sort((a, b) => b.mmi - a.mmi);
}
