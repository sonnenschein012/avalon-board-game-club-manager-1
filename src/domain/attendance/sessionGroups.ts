import type { Attendee, Member, SessionGroup, StoredSessionGroup } from '../../types';
import { getMemberFromAttendee } from '../matching/getMemberFromAttendee';

/** Translate the planning canvas's attendee IDs to persisted member IDs. */
export function convertAttendeeIdsToMemberIds(
  groups: SessionGroup[],
  attendees: Attendee[],
  members: Member[]
): StoredSessionGroup[] {
  return groups.map(group => ({
    ...group,
    memberIds: group.memberIds.map(attendeeId => {
      const attendee = attendees.find(item => item.id === attendeeId);
      const member = getMemberFromAttendee(members, attendee?.name, attendee?.studentIdPrefix);
      return member ? member.id : attendeeId;
    }),
  }));
}
