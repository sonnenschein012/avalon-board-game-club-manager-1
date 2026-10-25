import { describe, expect, it } from 'vitest';
import { createGameFormData, validateGamePlayerRanges } from './gameForm';
import type { Game } from '../../types';

describe('game form values', () => {
  it('preserves unrated and unspecified values when editing another field', () => {
    const game: Game = { id: 'unrated', title: '미평가 게임', minPlayers: 0, maxPlayers: 0,
      bestMinPlayers: 0, bestMaxPlayers: 0, complexity: 0, genres: [], memo: '이전 메모' };
    expect({ ...createGameFormData(game), memo: '수정한 메모' }).toEqual({
      title: game.title, minPlayers: 0, maxPlayers: 0, bestMinPlayers: 0, bestMaxPlayers: 0,
      complexity: 0, genres: [], memo: '수정한 메모',
    });
    expect(createGameFormData()).toMatchObject({ minPlayers: 2, maxPlayers: 4, complexity: 1 });
  });

  it.each([-1, 2.5, NaN, Infinity])('rejects invalid player counts: %s', value => {
    for (const field of ['minPlayers', 'maxPlayers', 'bestMinPlayers', 'bestMaxPlayers']) {
      expect(validateGamePlayerRanges({ ...createGameFormData(), [field]: value })).not.toBeNull();
    }
  });

  it('rejects reversed possible and recommended ranges but preserves unknown bounds', () => {
    expect(validateGamePlayerRanges({ ...createGameFormData(), minPlayers: 5, maxPlayers: 2 })).toContain('가능 인원');
    expect(validateGamePlayerRanges({ ...createGameFormData(), bestMinPlayers: 5, bestMaxPlayers: 2 })).toContain('적정 인원');
    expect(validateGamePlayerRanges({ minPlayers: 0, maxPlayers: 4, bestMinPlayers: 2, bestMaxPlayers: 0 })).toBeNull();
  });
});
