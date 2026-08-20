import { Member } from '../../types';

function parseSemester(semester: string | undefined | null) {
  const match = semester?.trim().match(/^(\d{4})-([12])$/);
  return match ? { year: Number(match[1]), term: Number(match[2]) } : null;
}

function compareSemesters(left: string, right: string) {
  const a = parseSemester(left);
  const b = parseSemester(right);
  if (!a || !b) return left.localeCompare(right);
  return a.year === b.year ? a.term - b.term : a.year - b.year;
}

/** Whether a member was active during the given semester based on roster history. */
export function isMemberActiveAtSemester(member: Member, semester: string) {
  return Boolean(member.semester)
    && compareSemesters(member.semester, semester) <= 0
    && (!member.dormantSemester || compareSemesters(member.dormantSemester, semester) > 0);
}

export function getActiveMembersAtSemester(members: Member[], semester: string) {
  return members.filter(member => isMemberActiveAtSemester(member, semester)).length;
}

export function getNewbieMembersAtSemester(members: Member[], semester: string) {
  return members.filter(member => member.semester === semester && isMemberActiveAtSemester(member, semester)).length;
}
