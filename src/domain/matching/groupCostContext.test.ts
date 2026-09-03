import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Attendee, Member, Session } from '../../types';
import { buildGroupCostContext } from './groupCostContext';

const timestamp = (date: string) => Timestamp.fromDate(new Date(`${date}T00:00:00`));

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'm23',
  name: '김민수',
  nickname: '',
  studentId: '20230000',
  phone: '',
  gender: '남',
  semester: '2026-2',
  preferredGenre: [],
  createdAt: timestamp('2026-01-01'),
  ...overrides,
});

const attendee = (overrides: Partial<Attendee> = {}): Attendee => ({
  id: 'a23',
  name: '김민수',
  studentIdPrefix: '23',
  request: '',
  importDate: timestamp('2026-09-12'),
  importId: 'import',
  status: '대기',
  ...overrides,
});

const session = (date: string, memberIds: string[]): Session => ({
  id: date,
  name: 'regular meeting',
  date: timestamp(date),
  groups: [{ id: 'group', memberIds, gameIds: [] }],
});

describe('buildGroupCostContext', () => {
  it('uses canonical name/prefix matches for pool balance and member requests', () => {
    const context = buildGroupCostContext({
      attendees: [
        attendee({ request: '이하나님과 같은 조' }),
        attendee({ id: 'a25', studentIdPrefix: '25' }),
        attendee({ id: 'unknown', name: '미등록', request: '김민수' }),
      ],
      members: [
        member({ id: 'm25', studentId: '20250000', gender: '여' }),
        member(),
        member({ id: 'm3', name: '이하나', studentId: '20210000' }),
      ],
      sessions: [],
      assignmentDate: '2026-09-12',
    });

    expect(context.overallGenderRatio).toBe(0.5);
    expect(context.vPool).toBe(1);
    expect(context.memberExperience).toEqual({ m23: 0, m25: 0 });
    expect(context.memberActivity).toEqual({ m23: 0.5, m25: 0.5 });
    // Requests retain the existing full-member-list matching, including members
    // who are not attending; the scorer only rewards pairs present in a group.
    expect(context.requestedPairs).toEqual([{ a: 'm23', b: 'm3' }]);
  });

  it('keeps participation cutoff and latest-three-session reunion history distinct', () => {
    const context = buildGroupCostContext({
      attendees: [attendee(), attendee({ id: 'a25', studentIdPrefix: '25' })],
      members: [member(), member({ id: 'm25', studentId: '20250000' })],
      sessions: [
        session('2026-09-20', ['m25', 'm23']),
        session('2026-09-12', ['m23', 'm25']),
        session('2026-09-05', ['m23']),
        session('2026-04-10', ['m23', 'm25']),
      ],
      assignmentDate: '2026-09-12',
    });

    expect(context.memberExperience.m23).toBeCloseTo(1 - Math.exp(-2 / 4));
    expect(context.memberExperience.m25).toBeCloseTo(1 - Math.exp(-1 / 4));
    expect(context.memberActivity.m23).toBeCloseTo(2 / 3);
    expect(context.memberActivity.m25).toBeCloseTo(1 / 3);
    expect(context.overallExperienceAverage).toBeCloseTo((2 - Math.exp(-2 / 4) - Math.exp(-1 / 4)) / 2);
    expect(context.overallActivityAverage).toBe(0.5);
    expect(context.memberPairRecentCounts).toEqual({ 'm23|m25': 2 });
    expect(context.memberPairLastSession).toEqual({ 'm23|m25': true });
  });

  it('retains neutral defaults for an empty pool and the existing unknown-year fallback', () => {
    const context = buildGroupCostContext({ attendees: [], members: [], sessions: [], assignmentDate: '2026-09-12' });
    expect(context).toEqual({
      overallGenderRatio: 0,
      vPool: 0,
      memberExperience: {},
      memberActivity: {},
      overallExperienceAverage: 0,
      overallActivityAverage: 0.5,
      memberPairRecentCounts: {},
      memberPairLastSession: {},
      requestedPairs: [],
    });

    const withUnknownYear = buildGroupCostContext({
      attendees: [attendee(), attendee({ id: 'a-unknown', name: '학번 미상', studentIdPrefix: '' })],
      members: [member(), member({ id: 'm-unknown', name: '학번 미상', studentId: '' })],
      sessions: [],
      assignmentDate: '2026-09-12',
    });
    expect(withUnknownYear.vPool).toBe(1);
  });
});
