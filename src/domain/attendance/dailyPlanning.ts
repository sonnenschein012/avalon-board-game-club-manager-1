import type { Attendee, StoredSessionGroup } from '../../types';

/** Operating groups contain member IDs and, for explicit guests, guest attendee IDs.
 * The attendee snapshot supplies guest names, drinks and structured invitations.
 * These groups must be converted before writing long-term sessions. */
export interface DailyPlanning {
  name: string;
  date: string;
  groups: StoredSessionGroup[];
  sessionId?: string;
  /** Snapshot at meeting start; independent of the replaceable attendance roster. */
  attendees?: Attendee[];
}
