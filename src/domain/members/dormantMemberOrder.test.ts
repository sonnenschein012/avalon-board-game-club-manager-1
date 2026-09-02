import { describe, expect, it } from 'vitest';
import { sortDormantMembers } from './dormantMemberOrder';

const member = (id: string, name: string, dormantSemester?: string) => ({
  id,
  name,
  nickname: '',
  ...(dormantSemester ? { dormantSemester } : {}),
});

describe('dormant member ordering', () => {
  it('sorts by the most recent dormant semester before Korean name', () => {
    const sorted = sortDormantMembers([
      member('older-park', '박보드', '2025-2'),
      member('recent-lee', '이루리', '2026-1'),
      member('recent-kim', '김가나', '2026-1'),
      member('oldest-choi', '최다람', '2025-1'),
    ]);

    expect(sorted.map(item => item.id)).toEqual([
      'recent-kim', 'recent-lee', 'older-park', 'oldest-choi',
    ]);
  });

  it('places members with no dormant semester after dated dormant records', () => {
    const sorted = sortDormantMembers([
      member('missing', '가나다'),
      member('dated', '하하하', '2026-1'),
    ]);

    expect(sorted.map(item => item.id)).toEqual(['dated', 'missing']);
  });
});
