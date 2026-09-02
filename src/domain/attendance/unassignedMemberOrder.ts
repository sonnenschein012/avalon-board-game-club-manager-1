import type { Member } from '../../types';

type SortableMember = Pick<Member, 'id' | 'name' | 'nickname' | 'status'>;

/**
 * Places active members before dormant members, then orders each roster by name.
 * Member IDs missing from the current roster remain visible at the end.
 */
export function sortUnassignedMemberIds<T extends SortableMember>(
  memberIds: readonly string[],
  members: readonly T[],
): string[] {
  const membersById = new Map(members.map(member => [member.id, member]));
  const collator = new Intl.Collator('ko-KR', { sensitivity: 'base' });

  return [...new Set(memberIds)].sort((leftId, rightId) => {
    const left = membersById.get(leftId);
    const right = membersById.get(rightId);

    if (!left && !right) return collator.compare(leftId, rightId);
    if (!left) return 1;
    if (!right) return -1;

    const rosterOrder = Number(left.status === '휴면') - Number(right.status === '휴면');
    if (rosterOrder !== 0) return rosterOrder;

    return collator.compare(left.name, right.name)
      || collator.compare(left.nickname, right.nickname)
      || collator.compare(left.id, right.id);
  });
}
