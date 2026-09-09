import { describe, expect, it } from 'vitest';
import { koreaDateKey } from './koreaDate';

describe('Korean calendar date', () => {
  it('changes at Korean midnight, including the year boundary', () => {
    expect(koreaDateKey(new Date('2026-09-09T14:59:59Z'))).toBe('2026-09-09');
    expect(koreaDateKey(new Date('2026-09-09T15:00:00Z'))).toBe('2026-09-10');
    expect(koreaDateKey(new Date('2026-09-09T17:00:00Z'))).toBe('2026-09-10');
    expect(koreaDateKey(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });
});
