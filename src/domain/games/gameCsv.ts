import type { Game } from '../../types';
import type { GameFormData } from './gameForm';

interface GameCsvImport {
  games: GameFormData[];
  skippedCount: number;
  error?: 'empty' | 'missing-columns';
}

function recommendedPlayerRange(value: string, minPlayers: number, maxPlayers: number) {
  const range = value.match(/(\d+)\s*~\s*(\d+)/);
  if (range) return [parseInt(range[1] || ''), parseInt(range[2] || '')] as const;

  const numbers = value.match(/\d+/g)?.map(number => parseInt(number));
  return numbers?.length
    ? [Math.min(...numbers), Math.max(...numbers)] as const
    : [minPlayers, maxPlayers] as const;
}

/** Converts the library CSV formats without changing existing catalog entries. */
export function parseGameCsv(
  rows: readonly (readonly string[])[],
  existingGames: readonly Pick<Game, 'title'>[],
): GameCsvImport {
  const headers = rows[0];
  if (!headers || rows.length < 2) return { games: [], skippedCount: 0, error: 'empty' };

  const titleIndex = headers.indexOf('이름') !== -1 ? headers.indexOf('이름') : headers.indexOf('게임명');
  const minIndex = headers.indexOf('최소인원');
  const maxIndex = headers.indexOf('최대인원');
  if (titleIndex === -1 || minIndex === -1 || maxIndex === -1) {
    return { games: [], skippedCount: 0, error: 'missing-columns' };
  }

  const difficultyIndex = headers.indexOf('난이도(1~5)') !== -1 ? headers.indexOf('난이도(1~5)') : headers.indexOf('난이도');
  const genreIndex = headers.indexOf('장르');
  const recommendedIndex = headers.indexOf('추천인원');
  const recommendedMinIndex = headers.indexOf('추천최소인원');
  const recommendedMaxIndex = headers.indexOf('추천최대인원');
  const memoIndex = headers.indexOf('메모');
  const currentTitles = new Set(existingGames.map(game => game.title));
  const games: GameFormData[] = [];
  let skippedCount = 0;

  for (const row of rows.slice(1)) {
    const rawTitle = row[titleIndex];
    if (!rawTitle) continue;

    const title = rawTitle.trim();
    if (!title || currentTitles.has(title)) {
      skippedCount++;
      continue;
    }

    const minPlayers = parseInt(row[minIndex] || '') || 0;
    const maxPlayers = parseInt(row[maxIndex] || '') || 0;
    const complexity = parseFloat(row[difficultyIndex] || '') || 0;
    const rawGenre = row[genreIndex] || '';
    const genres = rawGenre.split(rawGenre.includes('/') ? '/' : ',').map(genre => genre.trim()).filter(Boolean);

    let bestMinPlayers = minPlayers;
    let bestMaxPlayers = maxPlayers;
    if (recommendedMinIndex !== -1 && recommendedMaxIndex !== -1 && row[recommendedMinIndex] && row[recommendedMaxIndex]) {
      bestMinPlayers = parseInt(row[recommendedMinIndex] || '') || minPlayers;
      bestMaxPlayers = parseInt(row[recommendedMaxIndex] || '') || maxPlayers;
    } else if (recommendedIndex !== -1 && row[recommendedIndex]) {
      [bestMinPlayers, bestMaxPlayers] = recommendedPlayerRange(row[recommendedIndex] || '', minPlayers, maxPlayers);
    }

    games.push({
      title, minPlayers, maxPlayers, bestMinPlayers, bestMaxPlayers, complexity, genres,
      memo: memoIndex !== -1 ? (row[memoIndex] || '').trim() : '',
    });
    currentTitles.add(title);
  }

  return { games, skippedCount };
}
