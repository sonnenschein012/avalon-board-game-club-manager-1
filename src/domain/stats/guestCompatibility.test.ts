import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Game, Member, Session } from '../../types';
import { getAttendanceRanking } from './getAttendanceRanking';
import { getAttendanceTrend } from './getAttendanceTrend';
import { getNewcomerTrend } from './getNewcomerTrend';
import { getStagnationIndex } from './getStagnationIndex';
import { getCorePlayers } from './getCorePlayers';
import { getPopularGames } from './getPopularGames';
import { getGameMmi } from './getGameMmi';
import { buildMembersCsv } from '../exports/clubCsv';

const members = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, name: `회원${i}`, nickname: '', semester: i === 1 ? '2026-2' : '2025-1', gender: '남', studentId: '23', preferredGenre: [], phone: '', createdAt: Timestamp.fromDate(new Date('2025-01-01')) })) as Member[];
const games: Game[] = [{ id: 'game', title: '게임', genres: ['전략'], complexity: 2 }];
const sessions: Session[] = [1, 2, 3].map(i => ({ id: `s${i}`, name: '모임', date: Timestamp.fromDate(new Date(`2026-10-0${i}T12:00:00Z`)), groups: [{ id: 'group', memberIds: ['m0', 'm1'], gameIds: ['game'] }] }));
const results = (data: Session[]) => ({
  ranking: getAttendanceRanking(data, members, true),
  attendance: getAttendanceTrend(data, members),
  newcomers: getNewcomerTrend(data, members, true),
  stagnation: getStagnationIndex(data),
  core: getCorePlayers(data, games, members, [], [], true, []),
  popular: getPopularGames(data, games, 4, [], []),
  mmi: getGameMmi(data, 4, games),
  memberCsv: buildMembersCsv(members, data),
});

describe('anonymous session guests and member statistics', () => {
  it('keeps every existing archive metric and member CSV invariant under guest changes', () => {
    for (const guestCount of [0, 1, 7]) {
      const withGuests = sessions.map(s => ({ ...s, groups: s.groups.map(g => ({ ...g, guestCount })) }));
      expect(results(withGuests)).toEqual(results(sessions));
    }
  });
  it('still responds to actual member attendance and game changes', () => {
    const changed = sessions.map(s => ({ ...s, groups: s.groups.map(g => ({ ...g, guestCount: 4, memberIds: ['m0', 'm2'], gameIds: [] })) }));
    expect(results(changed).ranking).not.toEqual(results(sessions).ranking);
    expect(results(changed).popular).not.toEqual(results(sessions).popular);
    expect(results(changed).mmi).not.toEqual(results(sessions).mmi);
  });
});
