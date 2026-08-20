import { describe, expect, it } from 'vitest';
import { getDefaultSessionName, getLocalDateKey, getTodaySessionMetadata } from './sessionMetadata';

describe('daily session metadata', () => {
  it('derives the date key from the device local calendar, not UTC', () => {
    const date = {
      getFullYear: () => 2026,
      getMonth: () => 7,
      getDate: () => 20,
      toISOString: () => '2026-08-19T15:30:00.000Z',
    } as unknown as Date;

    expect(getLocalDateKey(date)).toBe('2026-08-20');
  });

  it('uses the same date in the default Korean display name', () => {
    expect(getDefaultSessionName('2026-08-20')).toBe('2026. 8. 20. 정기 모임');
    expect(getTodaySessionMetadata(new Date(2026, 7, 20))).toEqual({
      sessionDate: '2026-08-20',
      sessionName: '2026. 8. 20. 정기 모임',
    });
  });

  it('does not turn an invalid date key into a misleading date', () => {
    expect(getDefaultSessionName('not-a-date')).toBe('정기 모임');
  });
});
