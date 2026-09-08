import { useEffect, useState, type SetStateAction } from 'react';
import type { SessionGroup } from '../types';
import { getDefaultSessionName, getTodaySessionMetadata } from '../domain/attendance/sessionMetadata';

export interface AttendanceDraft {
  sessionName: string;
  sessionDate: string;
  isSessionNameCustom: boolean;
  groups: SessionGroup[];
  isAutoMode: boolean;
}

const drafts = new Map<string, AttendanceDraft>();
const storageKey = (scope: string) => `avalon:attendance-draft:v1:${scope}`;
const defaultDraft = (): AttendanceDraft => ({
  ...getTodaySessionMetadata(), isSessionNameCustom: false, groups: [], isAutoMode: false,
});

function isDraft(value: unknown): value is AttendanceDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as AttendanceDraft;
  return typeof draft.sessionName === 'string' && typeof draft.sessionDate === 'string'
    && typeof draft.isSessionNameCustom === 'boolean' && typeof draft.isAutoMode === 'boolean'
    && Array.isArray(draft.groups) && draft.groups.every(group => group && typeof group.id === 'string'
      && Array.isArray(group.memberIds) && group.memberIds.every(id => typeof id === 'string')
      && Array.isArray(group.gameIds) && group.gameIds.every(id => typeof id === 'string')
      && (group.name === undefined || typeof group.name === 'string')
      && (group.notes === undefined || typeof group.notes === 'string')
      && (group.targetSize === undefined || (Number.isFinite(group.targetSize) && group.targetSize >= 0)));
}

function readDraft(scope: string | null, initial?: AttendanceDraft): AttendanceDraft {
  if (scope) {
    const cached = drafts.get(scope);
    if (cached) return cached;
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? 'null');
      if (isDraft(stored)) return stored;
    } catch { /* A blocked or corrupt store must not prevent editing. */ }
  }
  return initial ?? defaultDraft();
}

/** The page must be keyed by scope so drafts never cross signed-in accounts. */
export function useAttendanceDraft(scope: string | null, initial?: AttendanceDraft) {
  const [draft, setDraft] = useState(() => readDraft(scope, initial));
  useEffect(() => {
    if (!scope) return;
    drafts.set(scope, draft);
    try { sessionStorage.setItem(storageKey(scope), JSON.stringify(draft)); }
    catch { /* The in-memory copy still survives navigation when storage is unavailable. */ }
  }, [draft, scope]);

  const setGroups = (update: SetStateAction<SessionGroup[]>) => setDraft(current => ({
    ...current, groups: typeof update === 'function' ? update(current.groups) : update,
  }));
  const setSessionName = (sessionName: string) => setDraft(current => ({ ...current, sessionName, isSessionNameCustom: true }));
  const setSessionDate = (sessionDate: string) => setDraft(current => ({
    ...current, sessionDate, sessionName: current.isSessionNameCustom ? current.sessionName : getDefaultSessionName(sessionDate),
  }));
  const setIsAutoMode = (update: SetStateAction<boolean>) => setDraft(current => ({
    ...current, isAutoMode: typeof update === 'function' ? update(current.isAutoMode) : update,
  }));
  const resetDraft = () => {
    const next = defaultDraft();
    if (scope) {
      drafts.delete(scope);
      try { sessionStorage.removeItem(storageKey(scope)); } catch { /* Storage may be blocked. */ }
    }
    setDraft(next);
  };
  return { ...draft, setGroups, setSessionName, setSessionDate, setIsAutoMode, resetDraft };
}
