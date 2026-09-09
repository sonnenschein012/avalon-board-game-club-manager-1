import type { Attendee, StoredSessionGroup } from '../../types';

/** Saved group formation; its groups already contain member IDs, not attendee IDs. */
export interface DailyPlanning {
  name: string;
  date: string;
  groups: StoredSessionGroup[];
  sessionId?: string;
  /** Snapshot at meeting start; independent of the replaceable attendance roster. */
  attendees?: (Attendee & { memberId: string })[];
}
