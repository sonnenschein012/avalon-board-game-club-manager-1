import { describe, it, expect } from 'vitest';
import { getMemberFromAttendee } from './getMemberFromAttendee';
import { Member } from '../../types';
import type { Timestamp } from 'firebase/firestore';

describe('getMemberFromAttendee', () => {
  const members: Member[] = [
    { id: '1', name: '김철수', studentId: '20231111', gender: '남', semester: '1', nickname: '', phone: '', preferredGenre: [], createdAt: { toMillis: () => 0 } as unknown as Timestamp },
    { id: '2', name: '홍길동', studentId: '20220000', gender: '남', semester: '1', nickname: '', phone: '', preferredGenre: [], createdAt: { toMillis: () => 0 } as unknown as Timestamp },
    { id: '3', name: '이영희', studentId: '23555555', gender: '여', semester: '1', nickname: '', phone: '', preferredGenre: [], createdAt: { toMillis: () => 0 } as unknown as Timestamp },
    { id: '4', name: '김철수', studentId: '20211111', gender: '남', semester: '1', nickname: '', phone: '', preferredGenre: [], createdAt: { toMillis: () => 0 } as unknown as Timestamp },
  ];

  it('matches by name correctly', () => {
    const member = getMemberFromAttendee(members, '홍길동');
    expect(member?.id).toBe('2');
  });

  it('matches by name and studentIdPrefix correctly', () => {
    const member23 = getMemberFromAttendee(members, '김철수', '23');
    expect(member23?.id).toBe('1');
    
    // Fallbacks to first match if prefix is '21'
    const member21 = getMemberFromAttendee(members, '김철수', '21');
    expect(member21?.id).toBe('4');
  });

  it('returns undefined when not matched', () => {
    const member = getMemberFromAttendee(members, '아무개');
    expect(member).toBeUndefined();
  });

  it('handles empty parameters gracefully', () => {
    expect(getMemberFromAttendee(members, undefined)).toBeUndefined();
    expect(getMemberFromAttendee([], '김철수')).toBeUndefined();
  });
});
