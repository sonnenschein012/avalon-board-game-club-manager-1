import { describe, expect, it } from 'vitest';
import { Member } from '../../types';
import { getActiveMembersAtSemester, getNewbieMembersAtSemester } from './getSemesterRosterCounts';

const members: Member[] = [
  { id: 'continuing', name: '계속 활동', nickname: '', studentId: '', phone: '', gender: '남', semester: '2025-2', preferredGenre: [], createdAt: {} as Member['createdAt'] },
  { id: 'newbie', name: '신입', nickname: '', studentId: '', phone: '', gender: '여', semester: '2026-1', preferredGenre: [], createdAt: {} as Member['createdAt'] },
  { id: 'dormant', name: '휴면 전환', nickname: '', studentId: '', phone: '', gender: '남', semester: '2025-2', dormantSemester: '2026-1', preferredGenre: [], createdAt: {} as Member['createdAt'] },
];

describe('semester roster counts', () => {
  it('uses the roster that existed in the selected semester', () => {
    expect(getActiveMembersAtSemester(members, '2025-2')).toBe(2);
    expect(getActiveMembersAtSemester(members, '2026-1')).toBe(2);
  });

  it('counts only active members who joined in that semester as newcomers', () => {
    expect(getNewbieMembersAtSemester(members, '2025-2')).toBe(2);
    expect(getNewbieMembersAtSemester(members, '2026-1')).toBe(1);
  });
});
