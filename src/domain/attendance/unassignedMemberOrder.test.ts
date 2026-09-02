import { describe, expect, it } from 'vitest';
import type { Member } from '../../types';
import { sortUnassignedMemberIds } from './unassignedMemberOrder';

const member = (id: string, name: string, status?: '활동' | '휴면') => {
  const value: Pick<Member, 'id' | 'name' | 'nickname' | 'status'> = { id, name, nickname: '' };
  if (status) value.status = status;
  return value;
};

describe('unassigned member ordering', () => {
  it('places active members first and sorts each roster in Korean alphabetical order', () => {
    const members = [
      member('dormant-hong', '홍길동', '휴면'),
      member('active-park', '박보드'),
      member('dormant-kim', '김휴면', '휴면'),
      member('active-kim', '김활동', '활동'),
    ];

    expect(sortUnassignedMemberIds([
      'dormant-hong', 'active-park', 'dormant-kim', 'active-kim',
    ], members)).toEqual([
      'active-kim', 'active-park', 'dormant-kim', 'dormant-hong',
    ]);
  });

  it('treats members without a status as active and removes duplicate IDs', () => {
    const members = [member('dormant', '가나', '휴면'), member('active', '나다')];

    expect(sortUnassignedMemberIds(['dormant', 'active', 'active'], members)).toEqual(['active', 'dormant']);
  });
});
