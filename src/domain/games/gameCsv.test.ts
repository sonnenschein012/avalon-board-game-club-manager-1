import { describe, expect, it } from 'vitest';
import { parseGameCsv } from './gameCsv';

describe('parseGameCsv', () => {
  it('preserves explicit unspecified bounds and accepts legacy hyphen ranges', () => {
    const result = parseGameCsv([
      ['게임명', '최소인원', '최대인원', '추천인원', '추천최소인원', '추천최대인원'],
      ['미지정 추천', '2', '8', '', '0', '0'],
      ['하이픈 범위', '2', '8', '3-5'],
    ], []);
    expect(result.error).toBeUndefined();
    expect(result.games.map(game => [game.bestMinPlayers, game.bestMaxPlayers])).toEqual([[0, 0], [3, 5]]);
  });

  it.each(['.5', '-.5', '2.5', '-1'])('rejects fractional or negative recommendation text: %s', value => {
    expect(parseGameCsv([
      ['게임명', '최소인원', '최대인원', '추천인원'], ['잘못된 추천', '2', '8', value],
    ], []).error).toBe('invalid-players');
  });

  it('rejects the entire file with row-specific reasons for invalid player ranges', () => {
    const result = parseGameCsv([
      ['게임명', '최소인원', '최대인원', '추천인원', '추천최소인원', '추천최대인원'],
      ['정상', '2', '4'],
      [''],
      ['역전', '5', '2'],
      ['음수', '-1', '4'],
      ['소수', '2.5', '4'],
      ['추천 역전', '2', '8', '5 ~ 3'],
      ['추천 음수', '2', '8', '-1 ~ 4'],
      ['추천 소수', '2', '8', '', '2.5', '4'],
    ], []);
    expect(result.error).toBe('invalid-players');
    expect(result.games).toEqual([]);
    expect(result.issues?.map(issue => issue.row)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(result.issues?.[0]?.message).toContain('가능 인원');
    expect(result.issues?.[3]?.message).toContain('적정 인원');
  });
  it('requires data rows and the title/minimum/maximum columns', () => {
    expect(parseGameCsv([], []).error).toBe('empty');
    expect(parseGameCsv([['게임명', '최소인원', '최대인원']], []).error).toBe('empty');
    expect(parseGameCsv([['게임명', '최소인원'], ['아발론', '5']], []).error).toBe('missing-columns');
  });

  it('accepts the legacy column aliases and keeps numeric/default and genre parsing rules', () => {
    const result = parseGameCsv([
      ['이름', '최소인원', '최대인원', '난이도(1~5)', '장르', '메모'],
      [' 아발론 ', '5명', '10', '1.8', '추리 / 마피아', ' 메모 '],
      ['러브레터', '', 'unknown', '', '카드, 추리', ''],
    ], []);

    expect(result.games).toEqual([
      { title: '아발론', minPlayers: 5, maxPlayers: 10, bestMinPlayers: 5, bestMaxPlayers: 10, complexity: 1.8, genres: ['추리', '마피아'], memo: '메모' },
      { title: '러브레터', minPlayers: 0, maxPlayers: 0, bestMinPlayers: 0, bestMaxPlayers: 0, complexity: 0, genres: ['카드', '추리'], memo: '' },
    ]);
  });

  it('deduplicates trimmed titles against the catalog and earlier rows without normalizing case', () => {
    const result = parseGameCsv([
      ['게임명', '최소인원', '최대인원'],
      [' Azul ', '2', '4'],
      ['신규', '3', '5'],
      [' 신규 ', '2', '6'],
      ['azul', '2', '4'],
      ['', '2', '4'],
      ['  ', '2', '4'],
    ], [{ title: 'Azul' }]);

    expect(result.games.map(game => [game.title, game.minPlayers])).toEqual([['신규', 3], ['azul', 2]]);
    expect(result.skippedCount).toBe(3);
  });

  it('supports recommended ranges, lists, single counts, and explicit column precedence', () => {
    const result = parseGameCsv([
      ['게임명', '최소인원', '최대인원', '추천인원', '추천최소인원', '추천최대인원', '난이도'],
      ['범위', '2', '8', '3 ~ 5', '', '', '2.2'],
      ['목록', '2', '8', '4, 6, 3명', '', '', ''],
      ['단일', '2', '8', '5명', '', '', ''],
      ['명시', '2', '8', '5명', '3', '4', ''],
      ['잘못된 명시', '2', '8', '5명', 'unknown', '0', ''],
      ['미지정', '2', '8', '미정', '', '', ''],
      ['일부 명시', '2', '8', '5명', '3', '', ''],
    ], []);

    expect(result.games.map(game => [game.bestMinPlayers, game.bestMaxPlayers])).toEqual([
      [3, 5], [3, 6], [5, 5], [3, 4], [2, 0], [2, 8], [5, 5],
    ]);
    expect(result.games[0]?.complexity).toBe(2.2);
  });
});
