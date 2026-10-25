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
    minPlayers: game?.minPlayers ?? 2,
    maxPlayers: game?.maxPlayers ?? 4,
    bestMinPlayers: game?.bestMinPlayers ?? game?.minPlayers ?? 2,
    bestMaxPlayers: game?.bestMaxPlayers ?? game?.maxPlayers ?? 4,
    complexity: game?.complexity ?? 1.0,
    memo: game?.memo || '',
    genres: game?.genres || [],
  };
}

/** Zero is the existing unspecified value; compare bounds only when both are known. */
export function validateGamePlayerRanges(game: Pick<GameFormData,
  'minPlayers' | 'maxPlayers' | 'bestMinPlayers' | 'bestMaxPlayers'>): string | null {
  for (const [label, min, max] of [
    ['가능 인원', game.minPlayers, game.maxPlayers],
    ['적정 인원', game.bestMinPlayers, game.bestMaxPlayers],
  ] as const) {
    if (![min, max].every(value => Number.isSafeInteger(value) && value >= 0)) {
      return `${label}은 0 이상의 정수로 입력해주세요. (0: 미지정)`;
    }
    if (min > 0 && max > 0 && min > max) return `${label}의 최소 인원은 최대 인원보다 클 수 없습니다.`;
  }
  return null;
}
