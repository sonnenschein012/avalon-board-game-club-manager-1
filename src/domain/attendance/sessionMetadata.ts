/**
 * Produces the calendar-date value used by the daily group-formation screen.
 *
 * `toISOString()` is deliberately not used here: it converts to UTC and can
 * therefore disagree with the date a Korean operator sees on their device.
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Creates the default, locale-independent display name for a local date key. */
export function getDefaultSessionName(sessionDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sessionDate);
  if (!match) return '정기 모임';

  const [, year, month, day] = match;
  return `${year}. ${Number(month)}. ${Number(day)}. 정기 모임`;
}

export function getTodaySessionMetadata(now = new Date()): { sessionDate: string; sessionName: string } {
  const sessionDate = getLocalDateKey(now);
  return {
    sessionDate,
    sessionName: getDefaultSessionName(sessionDate),
  };
}
