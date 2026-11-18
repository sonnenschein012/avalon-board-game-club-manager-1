import type { Session } from '../../types';
import { getLocalDateKey } from '../attendance/sessionMetadata';

/** A read-only projection for date-based charts; stored sessions remain independent. */
export function dailyAttendance(sessions: readonly Session[]): Session[] {
  const days = new Map<string, Session>();
  for (const session of sessions) {
    const date = session.date?.toDate?.();
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = getLocalDateKey(date);
    const previous = days.get(key);
    const memberIds = new Set([
      ...(previous?.groups[0]?.memberIds ?? []),
      ...session.groups.flatMap(group => group.memberIds),
    ]);
    days.set(key, {
      id: key, name: key, date: session.date,
      groups: [{ id: key, memberIds: [...memberIds], gameIds: [] }],
    });
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, day]) => day);
}
