import type { Session } from '../../types';
import { isSingleDocumentId } from '../shared/documentId';
import { getLocalDateKey } from './sessionMetadata';

interface ResolveDailySessionIdInput {
  planningSessionId?: unknown;
  sessions: readonly Session[];
  sessionDate: string;
  sessionName: string;
}

/** Resolves one stable session document for a daily planning record. */
export function resolveDailySessionId({
  planningSessionId,
  sessions,
  sessionDate,
  sessionName,
}: ResolveDailySessionIdInput): string {
  if (typeof planningSessionId === 'string' && isSingleDocumentId(planningSessionId)) {
    return planningSessionId.trim();
  }

  const matchingSession = sessions.find(session => {
    const date = session.date?.toDate?.();
    return date instanceof Date
      && getLocalDateKey(date) === sessionDate
      && session.name === sessionName;
  });

  return matchingSession?.id ?? `daily-${sessionDate}`;
}
