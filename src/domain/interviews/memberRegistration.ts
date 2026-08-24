import type { InterviewApplicant, Member } from '../../types';

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '');
}

export function normalizeMemberName(value: string) {
  return value.trim().replace(/\s+/g, '');
}

export function normalizeStudentYear(value: string) {
  const digits = value.replace(/\D/g, '');
  if (/^20\d{2}/.test(digits)) return digits.slice(2, 4);
  return digits.slice(0, 2);
}

export function formatMemberPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
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

export function defaultMemberNickname(name: string, studentYear: string) {
  return `${studentYear} ${name.trim()}`.trim();
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
