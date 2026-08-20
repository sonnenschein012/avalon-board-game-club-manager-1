import { describe, expect, it } from 'vitest';
import {
  addDaysToDateString,
  calculateApplicantTimeWindow,
  getKstDateString,
} from './publicTimeWindow';

describe('publicTimeWindow', () => {
  it('uses the KST calendar date, including the UTC boundary', () => {
    expect(getKstDateString(new Date('2026-09-01T15:00:00Z'))).toBe('2026-09-02');
  });

  it('adds calendar days across month and year boundaries', () => {
    expect(addDaysToDateString('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('excludes the access date and includes the following four calendar dates', () => {
    const slots = [
      '2026-09-01|14:00',
      '2026-09-02|14:00',
      '2026-09-03|15:00',
      '2026-09-04|16:00',
      '2026-09-05|17:00',
      '2026-09-06|14:00',
    ];
    const result = calculateApplicantTimeWindow(new Date('2026-09-01T10:00:00+09:00'), slots);
    expect(result.startDate).toBe('2026-09-02');
    expect(result.endDate).toBe('2026-09-05');
    expect(result.activeSlots).toEqual(slots.slice(1, 5));
  });

  it('remains stable when the same persisted first-access value is reused', () => {
    const firstAccessedAt = new Date('2026-09-01T10:00:00+09:00');
    const slots = ['2026-09-02|14:00', '2026-09-05|17:00', '2026-09-06|14:00'];
    const first = calculateApplicantTimeWindow(firstAccessedAt, slots);
    const reaccess = calculateApplicantTimeWindow(firstAccessedAt, slots);
    expect(reaccess).toEqual(first);
  });

  it('intersects the four-day window with round slots and ignores malformed IDs', () => {
    const result = calculateApplicantTimeWindow(new Date('2026-09-01T10:00:00+09:00'), [
      'not-a-slot',
      '2026-09-02T14:00',
      '2026-02-30|14:00',
      '2026-09-02|25:00',
      '2026-09-02|14:00',
      '2026-09-08|14:00',
    ]);
    expect(result.activeSlots).toEqual(['2026-09-02|14:00']);
  });

  it('returns valid round slots while the first access is not persisted', () => {
    const result = calculateApplicantTimeWindow(null, ['bad', '2026-09-01|14:00']);
    expect(result.startDate).toBe('');
    expect(result.endDate).toBe('');
    expect(result.activeSlots).toEqual(['2026-09-01|14:00']);
  });

  it('rejects invalid dates and invalid access values', () => {
    expect(() => addDaysToDateString('2026-02-30', 1)).toThrow(RangeError);
    expect(() => getKstDateString(new Date('invalid'))).toThrow(RangeError);
  });
});
