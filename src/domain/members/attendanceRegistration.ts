import type { Attendee, Member } from '../../types';
import { createMemberFormData, type MemberFormData } from './memberForm';
import { defaultMemberNickname, formatMemberPhone, normalizeMemberName, normalizeStudentYear } from './memberIdentity';

export type AttendanceMemberDraft = Omit<MemberFormData, 'gender'> & { gender: Member['gender'] | '' };

export function createAttendanceMemberDraft(attendee: Attendee): AttendanceMemberDraft {
  const studentId = normalizeStudentYear(attendee.studentIdPrefix || '');
  return { ...createMemberFormData(), name: attendee.name, studentId,
    nickname: defaultMemberNickname(attendee.name, studentId), gender: '' };
}

export function prepareAttendanceMember(input: AttendanceMemberDraft, members: readonly Member[]) {
  const name = input.name.trim();
  const studentId = normalizeStudentYear(input.studentId);
  const nickname = input.nickname.trim() || defaultMemberNickname(name, studentId);
  const semester = input.semester.trim();
  if (!name || !/^\d{2}$/.test(studentId)) throw new Error('이름과 두 자리 학번을 확인해주세요.');
  if (!['남', '여', '기타'].includes(input.gender)) throw new Error('성별을 선택해주세요.');
  if (!/^\d{4}-[12]$/.test(semester)) throw new Error('가입 학기는 2026-2 형식으로 입력해주세요.');
  // Attendance matching uses name and year, so a second identity with the same
  // pair cannot be distinguished here merely by changing its nickname.
  if (members.some(member => normalizeMemberName(member.name) === normalizeMemberName(name)
    && normalizeStudentYear(member.studentId) === studentId)) {
    throw new Error('이름과 학번이 같은 부원이 이미 있습니다. 명부와 출석 정보를 확인해주세요.');
  }
  return { ...input, name, studentId, nickname, semester, gender: input.gender as Member['gender'],
    phone: formatMemberPhone(input.phone), preferredGenre: [...input.preferredGenre],
    status: '활동' as const, dormantSemester: '' };
}
