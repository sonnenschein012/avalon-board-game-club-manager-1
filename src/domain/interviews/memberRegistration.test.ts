import { describe, expect, it } from 'vitest';
import type { InterviewApplicant, Member } from '../../types';
import {
  findMemberRegistrationMatches,
  formatMemberPhone,
  getRegistrationSemester,
  normalizeStudentYear,
  requiresDistinctMemberNickname,
} from './memberRegistration';

describe('interview member registration', () => {
  it.each([
    ['25', '25'],
    ['2025110909', '25'],
    ['25110909', '25'],
    ['20-24-123456', '24'],
  ])('normalizes %s to student year %s', (value, expected) => {
    expect(normalizeStudentYear(value)).toBe(expected);
  });

  it('formats common Korean phone number variants', () => {
    expect(formatMemberPhone('010 1234 5678')).toBe('010-1234-5678');
    expect(formatMemberPhone('010-123-4567')).toBe('010-123-4567');
  });

  it('uses the interview registration semester windows', () => {
    expect(getRegistrationSemester(new Date(2026, 0, 15))).toBe('2025-2');
    expect(getRegistrationSemester(new Date(2026, 1, 1))).toBe('2026-1');
    expect(getRegistrationSemester(new Date(2026, 6, 31))).toBe('2026-1');
    expect(getRegistrationSemester(new Date(2026, 7, 1))).toBe('2026-2');
  });

  it('matches only normalized name and student year', () => {
    const applicant = {
      name: '홍 길동', phone: '', applicationData: [{ header: '학번', value: '2025110909' }],
    } as InterviewApplicant;
    const members = [
      { id: 'same', name: '홍길동', studentId: '25' },
      { id: 'different-year', name: '홍길동', studentId: '24' },
      { id: 'same-name-only', name: '홍 길동', studentId: '26' },
    ] as Member[];
    expect(findMemberRegistrationMatches(applicant, members).map(member => member.id)).toEqual(['same']);
  });

  it('requires an intentional nickname change for same-semester namesakes', () => {
    const matches = [{ name: '홍길동', studentId: '25', semester: '2026-1', nickname: '길동왕' }] as Member[];
    expect(requiresDistinctMemberNickname({ name: '홍길동', studentId: '25', semester: '2026-1', nickname: '25 홍길동' }, matches)).toBe(true);
    expect(requiresDistinctMemberNickname({ name: '홍길동', studentId: '25', semester: '2026-1', nickname: '홍길동B' }, matches)).toBe(false);
  });
});
