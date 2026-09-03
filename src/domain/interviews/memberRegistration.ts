import type { InterviewApplicant, Member } from '../../types';
import { defaultMemberNickname, formatMemberPhone, normalizeMemberName, normalizeStudentYear } from '../members/memberIdentity';

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '');
}

export function getRegistrationSemester(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month === 1) return `${year - 1}-2`;
  if (month <= 7) return `${year}-1`;
  return `${year}-2`;
}

function applicationValue(applicant: InterviewApplicant, keys: string[]) {
  const field = applicant.applicationData.find(item => {
    const header = normalizedHeader(item.header);
    return keys.some(key => header.includes(key));
  });
  return field?.value?.trim() ?? '';
}

export function getApplicantStudentYear(applicant: InterviewApplicant) {
  const direct = (applicant as InterviewApplicant & { studentId?: unknown }).studentId;
  const raw = typeof direct === 'string' && direct.trim()
    ? direct
    : applicationValue(applicant, ['학번', 'studentid', 'studentnumber']);
  return normalizeStudentYear(raw);
}

export function getApplicantPhone(applicant: InterviewApplicant) {
  const raw = applicant.phone?.trim()
    || applicationValue(applicant, ['연락처', '전화번호', '휴대폰', 'phone', 'mobile']);
  return formatMemberPhone(raw);
}

export function findMemberRegistrationMatches(
  applicant: InterviewApplicant,
  members: readonly Member[],
) {
  const name = normalizeMemberName(applicant.name);
  const studentYear = getApplicantStudentYear(applicant);
  if (!name || !studentYear) return [];
  return members.filter(member => (
    normalizeMemberName(member.name) === name
    && normalizeStudentYear(member.studentId) === studentYear
  ));
}

export function hasNicknameConflict(nickname: string, matches: readonly Member[]) {
  const normalized = nickname.trim().toLocaleLowerCase('ko-KR');
  return Boolean(normalized) && matches.some(member => member.nickname.trim().toLocaleLowerCase('ko-KR') === normalized);
}

export function hasSameSemesterMatch(semester: string, matches: readonly Member[]) {
  return matches.some(member => member.semester.trim() === semester.trim());
}

export function requiresDistinctMemberNickname(input: {
  name: string;
  studentId: string;
  semester: string;
  nickname: string;
}, matches: readonly Member[]) {
  if (matches.length === 0) return false;
  if (hasNicknameConflict(input.nickname, matches)) return true;
  const defaultNickname = defaultMemberNickname(input.name, normalizeStudentYear(input.studentId)).toLocaleLowerCase('ko-KR');
  return hasSameSemesterMatch(input.semester, matches)
    && input.nickname.trim().toLocaleLowerCase('ko-KR') === defaultNickname;
}
