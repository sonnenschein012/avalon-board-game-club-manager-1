import { describe, expect, it } from 'vitest';
import { formatMemberPhone, normalizeStudentYear } from './memberIdentity';

describe('member identity', () => {
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

});
