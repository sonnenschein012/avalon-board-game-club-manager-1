import type { Member } from '../../types';
import { getSemester } from '../semester/getSemester';

export const defaultSemester = getSemester(new Date());

export const defaultDormantSemester = defaultSemester.endsWith('-1')
  ? `${defaultSemester.split('-')[0]}-2`
  : `${parseInt(defaultSemester.split('-')[0] || '') + 1}-1`;

export interface MemberFormData {
  name: string;
  nickname: string;
  studentId: string;
  phone: string;
  gender: '남' | '여' | '기타';
  semester: string;
  preferredGenre: string[];
  memo: string;
  isBoardMember: boolean;
  dormantSemester: string;
}

export function createMemberFormData(member?: Member): MemberFormData {
  return {
    name: member?.name || '',
    nickname: member?.nickname || '',
    studentId: member?.studentId || '',
    phone: member?.phone || '',
    gender: member?.gender || '남',
    semester: member?.semester || defaultSemester,
    preferredGenre: Array.isArray(member?.preferredGenre)
      ? member.preferredGenre
      : (member?.preferredGenre ? [member.preferredGenre as unknown as string] : []),
    memo: member?.memo || '',
    isBoardMember: member?.isBoardMember || false,
    dormantSemester: member?.dormantSemester || '',
  };
}
