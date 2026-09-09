import type { SessionGroup } from '../../types';

/** A single move removes any previous assignment and never duplicates the attendee. */
export function moveAttendee(groups: SessionGroup[], attendeeId: string, targetGroupId: string | null): SessionGroup[] {
  if (targetGroupId !== null && !groups.some(group => group.id === targetGroupId)) return groups;
  return groups.map(group => ({
    ...group,
    memberIds: group.id === targetGroupId
      ? [...new Set([...group.memberIds, attendeeId])]
      : group.memberIds.filter(id => id !== attendeeId),
  }));
}
