import type { Game } from '../../types';

export interface GameFormData {
  title: string;
  minPlayers: number;
  maxPlayers: number;
  bestMinPlayers: number;
  bestMaxPlayers: number;
  complexity: number;
  memo: string;
  genres: string[];
}

export function createGameFormData(game?: Game): GameFormData {
  return {
    title: game?.title || '',
    minPlayers: game?.minPlayers || 2,
    maxPlayers: game?.maxPlayers || 4,
    bestMinPlayers: game?.bestMinPlayers || game?.minPlayers || 2,
    bestMaxPlayers: game?.bestMaxPlayers || game?.maxPlayers || 4,
    complexity: game?.complexity || 1.0,
    memo: game?.memo || '',
    genres: game?.genres || [],
  };
}
