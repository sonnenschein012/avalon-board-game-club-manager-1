import type { Member } from '../../types';

type DormantSortableMember = Pick<Member, 'id' | 'name' | 'nickname' | 'dormantSemester'>;

/** Orders the dormant roster by most-recent dormant semester, then Korean name. */
export function sortDormantMembers<T extends DormantSortableMember>(members: readonly T[]): T[] {
  const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

  return [...members].sort((left, right) => {
    const leftSemester = left.dormantSemester?.trim() ?? '';
    const rightSemester = right.dormantSemester?.trim() ?? '';
    if (leftSemester && rightSemester) {
      const semesterOrder = collator.compare(rightSemester, leftSemester);
      if (semesterOrder !== 0) return semesterOrder;
    } else if (leftSemester) {
      return -1;
    } else if (rightSemester) {
      return 1;
    }

    return collator.compare(left.name, right.name)
      || collator.compare(left.nickname, right.nickname)
      || collator.compare(left.id, right.id);
  });
}
