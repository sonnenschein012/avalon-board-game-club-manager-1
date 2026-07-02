import { Member } from '../../types';
import { isSameName } from './isSameName';

/**
 * 이름과 학번 접두어(예: '23')를 이용하여 전체 멤버 목록에서 일치하는 멤버를 찾습니다.
 * @param members - 전체 Member 배열
 * @param name - 찾을 이름
 * @param studentIdPrefix - 찾을 학번 (두 자리 접두어)
 * @returns 일치하는 멤버 객체, 없으면 undefined
 * @example
 * getMemberFromAttendee(members, '김철수', '23')
 */
export const getMemberFromAttendee = (members: Member[], name?: string, studentIdPrefix?: string): Member | undefined => {
  if (!name) return undefined;
  
  const matchedMembers = members.filter(m => isSameName(m.name, name));
  
  if (studentIdPrefix) {
    return matchedMembers.find(m => {
      const mPrefix = m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '';
      return mPrefix === studentIdPrefix || m.studentId?.startsWith(studentIdPrefix);
    }) || matchedMembers[0];
  }
  
  return matchedMembers[0];
};
