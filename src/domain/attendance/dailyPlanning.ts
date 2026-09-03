import type { StoredSessionGroup } from '../../types';

/** Saved group formation; its groups already contain member IDs, not attendee IDs. */
export interface DailyPlanning {
  name: string;
  date: string;
  groups: StoredSessionGroup[];
  sessionId?: string;
}
