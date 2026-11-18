import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Session } from '../../types';
import { resolveDailySessionId, nextSessionName } from './dailySession';

const existingSession = (id: string, name: string, date: Date) => ({
  id,
  name,
  date: Timestamp.fromDate(date),
  groups: [],
}) satisfies Session;

describe('daily planning session identity', () => {
  it('reuses the session ID already linked to the planning record', () => {
    expect(resolveDailySessionId({
      planningSessionId: 'linked-session',
      sessions: [existingSession('legacy-session', '정기 모임', new Date(2026, 8, 2))],
      sessionDate: '2026-09-02',
      sessionName: '정기 모임',
    })).toBe('linked-session');
  });

  it('reuses a legacy session with the same date and name', () => {
    expect(resolveDailySessionId({
      sessions: [existingSession('legacy-session', '정기 모임', new Date(2026, 8, 2))],
      sessionDate: '2026-09-02',
      sessionName: '정기 모임',
    })).toBe('legacy-session');
  });

  it('uses a stable date-based ID for a new daily session', () => {
    expect(resolveDailySessionId({
      planningSessionId: 'invalid/path',
      sessions: [],
      sessionDate: '2026-09-02',
      sessionName: '정기 모임',
    })).toBe('daily-2026-09-02');
  });
});


it('allocates suffixes without overwriting manually named records', () => {
  expect(nextSessionName('Meeting', [])).toBe('Meeting');
  expect(nextSessionName('Meeting', ['Meeting'])).toBe('Meeting (2)');
  expect(nextSessionName('Meeting', ['Meeting', 'Meeting (2)'])).toBe('Meeting (3)');
  expect(nextSessionName('Meeting', ['Meeting', 'Meeting (3)'])).toBe('Meeting (2)');
});
