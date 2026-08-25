import { describe, expect, it } from 'vitest';
import { datesInRange } from './InterviewScheduleFormModal';

describe('interview schedule date ranges', () => {
  it('creates every date in an inclusive continuous range', () => {
    expect(datesInRange('2026-08-28', '2026-08-30')).toEqual([
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });

  it('rejects an inverted or incomplete range', () => {
    expect(datesInRange('2026-08-30', '2026-08-28')).toEqual([]);
    expect(datesInRange('', '2026-08-28')).toEqual([]);
  });
});
