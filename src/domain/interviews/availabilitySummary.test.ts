import { describe, expect, it } from 'vitest';
import { summarizeAvailabilitySlots } from './availabilitySummary';

describe('availability summary', () => {
  it('separates dates and merges consecutive cells', () => {
    const result = summarizeAvailabilitySlots([
      '2026-08-15|12:00', '2026-08-14|11:30', '2026-08-15|11:30',
      '2026-08-14|11:00', '2026-08-15|10:00',
    ], 30);
    expect(result.map(row => ({ dateKey: row.dateKey, ranges: row.ranges }))).toEqual([
      { dateKey: '2026-08-14', ranges: ['11:00~12:00'] },
      { dateKey: '2026-08-15', ranges: ['10:00~10:30', '11:30~12:30'] },
    ]);
  });
});
