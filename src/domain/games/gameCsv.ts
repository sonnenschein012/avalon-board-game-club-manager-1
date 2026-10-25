import type { Game } from '../../types';
import { validateGamePlayerRanges, type GameFormData } from './gameForm';

interface GameCsvImport {
  games: GameFormData[];
  skippedCount: number;
  error?: 'empty' | 'missing-columns' | 'invalid-players';
  issues?: { row: number; message: string }[];
}

function recommendedPlayerRange(value: string, minPlayers: number, maxPlayers: number) {
  const range = value.match(/(-?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:~|-)\s*(-?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (range) return [Number(range[1]), Number(range[2])] as const;

  const numbers = value.match(/-?(?:\d+(?:\.\d*)?|\.\d+)/g)?.map(Number);
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
  const issues: NonNullable<GameCsvImport['issues']> = [];
  let skippedCount = 0;

  for (const [index, row] of rows.entries()) {
    if (index === 0) continue;
    const rawTitle = row[titleIndex];
    if (!rawTitle) continue;

    const title = rawTitle.trim();
    if (!title || currentTitles.has(title)) {
      skippedCount++;
      continue;
    }

    const minPlayers = parseFloat(row[minIndex] || '') || 0;
    const maxPlayers = parseFloat(row[maxIndex] || '') || 0;
    const complexity = parseFloat(row[difficultyIndex] || '') || 0;
    const rawGenre = row[genreIndex] || '';
    const genres = rawGenre.split(rawGenre.includes('/') ? '/' : ',').map(genre => genre.trim()).filter(Boolean);

    let bestMinPlayers = minPlayers;
    let bestMaxPlayers = maxPlayers;
    if (recommendedMinIndex !== -1 && recommendedMaxIndex !== -1 && row[recommendedMinIndex] && row[recommendedMaxIndex]) {
      const parsedMin = parseFloat(row[recommendedMinIndex] || '');
      const parsedMax = parseFloat(row[recommendedMaxIndex] || '');
      bestMinPlayers = Number.isNaN(parsedMin) ? minPlayers : parsedMin;
      bestMaxPlayers = Number.isNaN(parsedMax) ? maxPlayers : parsedMax;
    } else if (recommendedIndex !== -1 && row[recommendedIndex]) {
      [bestMinPlayers, bestMaxPlayers] = recommendedPlayerRange(row[recommendedIndex] || '', minPlayers, maxPlayers);
    }

    const game = {
      title, minPlayers, maxPlayers, bestMinPlayers, bestMaxPlayers, complexity, genres,
      memo: memoIndex !== -1 ? (row[memoIndex] || '').trim() : '',
    };
    const issue = validateGamePlayerRanges(game);
    if (issue) {
      issues.push({ row: index + 1, message: `${title}: ${issue}` });
      continue;
    }
    games.push(game);
    currentTitles.add(title);
  }

  // Reject the file before any writes rather than silently importing only part of it.
  return issues.length ? { games: [], skippedCount, error: 'invalid-players', issues } : { games, skippedCount };
}
