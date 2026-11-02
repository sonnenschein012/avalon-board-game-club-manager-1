import type { Attendee, Member, SessionGroup, StoredSessionGroup } from '../../types';
import { attendeeMember, isGuest } from './guests';

/** Translate the planning canvas's attendee IDs to persisted member IDs. */
export function convertAttendeeIdsToMemberIds(
  groups: SessionGroup[],
  attendees: Attendee[],
  members: Member[]
): StoredSessionGroup[] {
  return groups.map(group => ({
    ...group,
    ...(group.memberIds.some(id => isGuest(attendees.find(a => a.id === id))) ? { guestCount: group.memberIds.filter(id => isGuest(attendees.find(a => a.id === id))).length } : {}),
    memberIds: group.memberIds.filter(id => !isGuest(attendees.find(a => a.id === id))).map(attendeeId => {
      const attendee = attendees.find(item => item.id === attendeeId);
      const member = attendeeMember(attendee, members);
      return member ? member.id : attendeeId;
    }),
  }));
}

/** Daily operations retain guest attendee IDs alongside real member IDs. */
export function convertAttendeeIdsToPlanningGroups(
  groups: SessionGroup[], attendees: Attendee[], members: Member[],
): StoredSessionGroup[] {
  return groups.map(group => ({
    ...group,
    memberIds: group.memberIds.map(id => {
      const attendee = attendees.find(a => a.id === id);
      return isGuest(attendee) ? id : attendeeMember(attendee, members)?.id ?? id;
    }),
  }));
}
