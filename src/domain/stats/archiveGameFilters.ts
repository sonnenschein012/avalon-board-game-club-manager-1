import type { Game } from '../../types';

// Archive buckets intentionally use whole-number boundaries; catalog filters use a different scale.
export const ARCHIVE_DIFFICULTY_RANGES = [
  { label: '1점대', match: (complexity: number) => complexity >= 1 && complexity < 2 },
  { label: '2점대', match: (complexity: number) => complexity >= 2 && complexity < 3 },
  { label: '3점대', match: (complexity: number) => complexity >= 3 && complexity < 4 },
  { label: '4점대 이상', match: (complexity: number) => complexity >= 4 },
];

export function matchesArchiveGameFilters(game: Game, genres: string[], difficulties: string[]) {
  if (genres.length > 0 && !game.genres?.some(genre => genres.includes(genre))) return false;
  if (difficulties.length === 0) return true;

  return difficulties.some(label => {
    const range = ARCHIVE_DIFFICULTY_RANGES.find(candidate => candidate.label === label);
    return range ? range.match(game.complexity || 0) : false;
  });
}
