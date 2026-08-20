import { describe, expect, it } from 'vitest';
import type { Member, Session } from '../../types';
import { getAttendanceRanking } from './getAttendanceRanking';
import { getAttendanceTrend } from './getAttendanceTrend';
import { getNewcomerTrend } from './getNewcomerTrend';

const timestamp = (value: string) => ({ toDate: () => new Date(value) });

const members = [
  { id: 'continuing', name: '재학생', semester: '2025-2' },
  { id: 'newbie', name: '신입생', semester: '2026-1' },
  { id: 'dormant', name: '휴면 전환', semester: '2025-2', dormantSemester: '2026-1' },
].map(member => ({
  nickname: '', studentId: '', phone: '', gender: '남', preferredGenre: [], createdAt: timestamp('2025-01-01'),
  ...member,
})) as unknown as Member[];

function session(overrides: Partial<Session>): Session {
  return {
    id: 'session',
    name: '정기 모임',
    date: timestamp('2026-04-01T10:00:00+09:00'),
    groups: [{ id: 'group', memberIds: ['continuing', 'newbie'], gameIds: [], notes: '' }],
    ...overrides,
  } as unknown as Session;
}

describe('semester statistics', () => {
  it('uses the roster that was active in the session semester for attendance rate', () => {
    const data = getAttendanceTrend([session({})], members);
    expect(data[0]).toMatchObject({ count: 2, rate: 100 });
  });

  it('uses the session board-member snapshot before the member current flag', () => {
    const boardSnapshot = session({ boardMemberIds: ['continuing'] });
    expect(getAttendanceRanking([boardSnapshot], members, false).map(item => item.id)).toEqual(['newbie']);
  });

  it('normalizes newcomer participation against the historical semester roster', () => {
    const data = getNewcomerTrend([
      session({ groups: [{ id: 'group', memberIds: ['continuing', 'newbie', 'guest'], gameIds: [], notes: '' }] }),
    ], [...members, { ...members[0], id: 'guest', name: '기존 회원' } as Member], true);
    expect(data[0]).toMatchObject({ 보정지수: 1 });
  });
});
