import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { Member, Session } from '../../types';
import { getParticipationHistory } from './participationHistory';

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'm1',
  name: 'Member',
  nickname: '',
  studentId: '20230000',
  phone: '',
  gender: '남',
  semester: '2026-2',
  preferredGenre: [],
  createdAt: Timestamp.fromDate(new Date('2026-09-01T00:00:00')),
  ...overrides,
});

const session = (date: string, memberIds: string[] = []): Session => ({
  id: date,
  name: 'regular meeting',
  date: Timestamp.fromDate(new Date(`${date}T00:00:00`)),
  groups: [{ id: `${date}-group`, memberIds, gameIds: [] }],
});

describe('getParticipationHistory', () => {
  it('uses only sessions strictly before an historical assignment date', () => {
    const history = getParticipationHistory(
      [member()],
      [session('2026-09-05', ['m1']), session('2026-09-12', ['m1']), session('2026-09-19', ['m1'])],
      '2026-09-12'
    );

    expect(history.attendanceCounts.m1).toBe(1);
    expect(history.currentSemesterAttendanceCounts.m1).toBe(1);
    expect(history.currentSemesterOpportunityCounts.m1).toBe(1);
  });

  it('does not count sessions before a member joined as current-semester opportunities', () => {
    const history = getParticipationHistory(
      [member({ createdAt: Timestamp.fromDate(new Date('2026-09-10T00:00:00')) })],
      [session('2026-09-05'), session('2026-09-11', ['m1']), session('2026-09-19', ['m1'])],
      '2026-09-12'
    );

    expect(history.currentSemesterAttendanceCounts.m1).toBe(1);
    expect(history.currentSemesterOpportunityCounts.m1).toBe(1);
  });
});
