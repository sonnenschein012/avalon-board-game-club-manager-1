import { describe, expect, it } from 'vitest';
import type { Game, Member, Session } from '../../types';
import { getCorePlayers } from './getCorePlayers';
import { getPopularGames } from './getPopularGames';

const games: Game[] = [
  { id: 'unknown', title: '정보 없음' },
  { id: 'below-one', title: '1점 미만', complexity: 0.9, genres: ['전략'] },
  { id: 'one', title: '1점', complexity: 1, genres: ['전략'] },
  { id: 'almost-two', title: '2점 직전', complexity: 1.99, genres: ['파티'] },
  { id: 'two', title: '2점', complexity: 2, genres: ['전략', '카드'] },
  { id: 'almost-three', title: '3점 직전', complexity: 2.99, genres: ['파티'] },
  { id: 'three', title: '3점', complexity: 3, genres: ['전략'] },
  { id: 'almost-four', title: '4점 직전', complexity: 3.99, genres: ['파티'] },
  { id: 'four', title: '4점', complexity: 4, genres: ['전략'] },
  { id: 'five', title: '5점', complexity: 5, genres: ['파티'] },
];

const members: Member[] = games.map(game => ({
  id: game.id, name: game.title, nickname: '', studentId: '', phone: '', gender: '기타',
  semester: '2026-1', preferredGenre: [], createdAt: {} as Member['createdAt'],
}));

const session: Session = {
  id: 'session', name: '정기 모임', date: {} as Session['date'],
  groups: games.map(game => ({ id: game.id, gameIds: [game.id], memberIds: [game.id] })),
};

describe('archive game statistics filters', () => {
  it.each<[string, string[]]>([
    ['1점대', ['one', 'almost-two']],
    ['2점대', ['two', 'almost-three']],
    ['3점대', ['three', 'almost-four']],
    ['4점대 이상', ['four', 'five']],
  ])('uses the same whole-number %s boundary for popular games and core players', (difficulty, expectedIds) => {
    expect(getPopularGames([session], games, members.length, [], [difficulty]).map(item => item.gameId)).toEqual(expectedIds);
    expect(getCorePlayers([session], games, members, [], [difficulty], true, []).map(item => item.id)).toEqual(expectedIds);
  });

  it('includes missing game metadata without filters and excludes deleted games', () => {
    const withDeletedGame = {
      ...session,
      groups: [...session.groups, { id: 'deleted', gameIds: ['deleted'], memberIds: ['one'] }],
    };

    expect(getPopularGames([withDeletedGame], games, members.length, [], []).map(item => item.gameId)).toEqual(games.map(game => game.id));
    expect(getCorePlayers([withDeletedGame], games, members, [], [], true, []).map(item => item.hits)).toEqual(games.map(() => 1));
  });

  it('combines genre and difficulty filters and keeps the core-player game selection independent', () => {
    expect(getPopularGames([session], games, members.length, ['카드', '파티'], ['1점대', '2점대']).map(item => item.gameId))
      .toEqual(['almost-two', 'two', 'almost-three']);
    expect(getCorePlayers([session], games, members, ['카드', '파티'], ['1점대', '2점대'], true, ['two']).map(item => item.id))
      .toEqual(['two']);
  });

  it('preserves session board-member snapshots when counting filtered core-player appearances', () => {
    const currentBoardMembers = members.map(member => ({ ...member, isBoardMember: member.id === 'two' }));
    const savedSession = { ...session, boardMemberIds: ['one'] };

    expect(getCorePlayers([savedSession], games, currentBoardMembers, ['전략'], ['1점대', '2점대'], false, []).map(item => item.id))
      .toEqual(['two']);
    expect(getCorePlayers([session], games, currentBoardMembers, ['전략'], ['1점대', '2점대'], false, []).map(item => item.id))
      .toEqual(['one']);
  });
});
