import { describe, it, expect } from 'vitest';
import { isSameName } from './isSameName';

describe('isSameName', () => {
  it('returns true for same names', () => {
    expect(isSameName('김철수', '김철수')).toBe(true);
  });

  it('returns false for different names', () => {
    expect(isSameName('김철수', '홍길동')).toBe(false);
  });

  it('ignores spaces and zero-width characters', () => {
    expect(isSameName('김철수', '김 철수')).toBe(true);
    expect(isSameName('김철수 ', ' 김철 수')).toBe(true);
  });

  it('ignores leading 2-digit numbers', () => {
    expect(isSameName('23김철수', '김철수')).toBe(true);
    expect(isSameName('김철수', '22김철수')).toBe(true);
  });

  it('ignores case', () => {
    expect(isSameName('John Doe', 'john doe')).toBe(true);
  });

  it('handles empty cases gently', () => {
    expect(isSameName('', undefined)).toBe(true);
    expect(isSameName('a', undefined)).toBe(false);
  });
});
