import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewAccess, InterviewPublicRound, InterviewPublicSchedule } from '../types';
import {
  initializePublicInterviewAccess,
  savePublicAvailability,
  subscribeToPublicInterview,
} from '../services/publicInterviewService';
import { getSurveyPhase } from '../domain/interviews/scheduling';
import { calculateApplicantTimeWindow } from '../domain/interviews/publicTimeWindow';

type PublicInterviewState = 'loading' | 'invalid' | 'inactive' | 'unassigned' | 'before' | 'collecting' | 'closed' | 'completed' | 'error';
const PUBLIC_LOAD_TIMEOUT_MS = 10_000;
const PUBLIC_INITIALIZATION_TIMEOUT_MS = 7_000;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

export function getPublicInterviewState(access: InterviewAccess | null, round: InterviewPublicRound | InterviewPublicSchedule | null, now: Date): PublicInterviewState {
  if (!access) return 'invalid';
  if (access.scheduleId === null) return 'unassigned';
  if (!access.active || !round?.active) return 'inactive';
  if (access.assignmentSummary?.status === 'completed') return 'completed';
  const opensAt = toDate(round.surveyOpensAt);
  const closesAt = toDate(round.surveyClosesAt);
  if (!opensAt || !closesAt) return 'error';
  let phase;
  try {
    phase = getSurveyPhase(now, opensAt, closesAt);
  } catch {
    return 'error';
  }
  if (phase === 'before') return 'before';
  if (phase === 'closed') return 'closed';
  return 'collecting';
}

export function resolvePublicInitializationState(
  baseState: PublicInterviewState,
  needsInitialization: boolean,
  scheduleId: string | null | undefined,
  initializationError: string | null,
): PublicInterviewState {
  if (!needsInitialization || scheduleId != null) return baseState;
  return initializationError ? 'error' : 'loading';
}

export function usePublicInterviewLogic(token: string | undefined) {
  const [access, setAccess] = useState<InterviewAccess | null>(null);
  const [round, setRound] = useState<InterviewPublicRound | InterviewPublicSchedule | null>(null);
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initializationRetry, setInitializationRetry] = useState(0);
  const [subscriptionRetry, setSubscriptionRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const localEditRef = useRef(false);
  const initializationKeyRef = useRef<string | null>(null);
  const initializationGenerationRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // A token can change without remounting this route. Never keep the
    // previous applicant's snapshot or local edit state while reconnecting.
    setAccess(null);
    setRound(null);
    setAvailability(new Set());
    setLoading(true);
    setLoadError(null);
    setInitializationError(null);
    setSaveError(null);
    setSaved(false);
    localEditRef.current = false;
    initializationGenerationRef.current += 1;
    initializationKeyRef.current = null;
    const loadTimeout = window.setTimeout(() => {
      setLoadError('연결이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
      setLoading(false);
    }, PUBLIC_LOAD_TIMEOUT_MS);

    const unsubscribe = subscribeToPublicInterview(
      token,
      (value) => {
        window.clearTimeout(loadTimeout);
        if (value.access?.firstAccessedAt != null) setInitializationError(null);
        setAccess(value.access);
        setRound(value.round);
        const scheduleWasReset = Boolean(value.access)
          && value.access?.firstAccessedAt == null
          && value.access?.submittedAt == null;
        if (scheduleWasReset) {
          // The reset transaction is authoritative: discard even unsaved
          // browser selections so the previous response cannot leak into the
          // new first-access window while this page remains open.
          localEditRef.current = false;
          setAvailability(new Set());
          setSaved(false);
          setSaveError(null);
        } else if (!localEditRef.current) {
          setAvailability(new Set(value.access?.availability ?? []));
        }
        setLoading(false);
        setLoadError(null);
      },
      () => {
        window.clearTimeout(loadTimeout);
        setLoadError('면접 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
      },
    );
    return () => {
      window.clearTimeout(loadTimeout);
      unsubscribe();
    };
  }, [subscriptionRetry, token]);

  const baseState = useMemo<PublicInterviewState>(() => {
    if (loading) return 'loading';
    if (loadError) return 'error';
    return getPublicInterviewState(access, round, now);
  }, [access, loadError, loading, now, round]);

  const needsAccessInitialization = baseState === 'collecting'
    && Boolean(token && access && round)
    && access?.firstAccessedAt == null;

  useEffect(() => {
    // Once the first access time is persisted, release the in-flight guard.
    // If an administrator later resets this same token, the open page can
    // create a fresh first-access basis without requiring a browser reload.
    if (!needsAccessInitialization) {
      initializationKeyRef.current = null;
      setInitializationError(null);
    }
  }, [needsAccessInitialization]);

  useEffect(() => {
    if (!token || !needsAccessInitialization || !round) return;
    const key = token;
    if (initializationKeyRef.current === key) return;
    initializationKeyRef.current = key;
    const generation = initializationGenerationRef.current;
    let finished = false;
    const timeout = window.setTimeout(() => {
      if (finished || generation !== initializationGenerationRef.current) return;
      // Firestore transactions cannot be cancelled safely. Surface a retry
      // instead of starting a second transaction behind the user's back.
      setInitializationError('면접 가능시간 준비가 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
    }, PUBLIC_INITIALIZATION_TIMEOUT_MS);
    void initializePublicInterviewAccess(token).then(() => {
      finished = true;
      window.clearTimeout(timeout);
    }).catch(() => {
      finished = true;
      window.clearTimeout(timeout);
      if (generation !== initializationGenerationRef.current) return;
      initializationKeyRef.current = null;
      setInitializationError('면접 가능시간 범위를 준비하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.');
    });
    return () => window.clearTimeout(timeout);
  }, [initializationRetry, needsAccessInitialization, round, token]);

  const retryInitialization = () => {
    const retryingSubscription = Boolean(loadError);
    initializationGenerationRef.current += 1;
    initializationKeyRef.current = null;
    setLoadError(null);
    setInitializationError(null);
    if (retryingSubscription) setLoading(true);
    setInitializationRetry(previous => previous + 1);
    if (retryingSubscription) setSubscriptionRetry(previous => previous + 1);
  };

  const state = resolvePublicInitializationState(
    baseState,
    needsAccessInitialization,
    access?.scheduleId,
    initializationError,
  );
  const visibleSlots = useMemo(() => {
    // Schedules are fixed by the administrator. Keep the legacy four-day
    // rolling window only for access links created before schedules existed.
    if (access?.scheduleId) return round?.allowedSlots ?? [];
    return calculateApplicantTimeWindow(
      toDate(access?.firstAccessedAt),
      round?.allowedSlots ?? [],
    ).activeSlots;
  }, [access?.firstAccessedAt, access?.scheduleId, round?.allowedSlots]);

  const toggleSlot = (slotId: string, force?: boolean) => {
    if (state !== 'collecting') return;
    localEditRef.current = true;
    setSaved(false);
    setSaveError(null);
    setAvailability((previous) => {
      const next = new Set(previous);
      const shouldSelect = force ?? !next.has(slotId);
      if (shouldSelect) next.add(slotId);
      else next.delete(slotId);
      return next;
    });
  };

  const replaceAvailability = (slotIds: string[]) => {
    if (state !== 'collecting') return;
    localEditRef.current = true;
    setSaved(false);
    setSaveError(null);
    const allowed = new Set(visibleSlots);
    setAvailability(new Set(slotIds.filter(slotId => allowed.has(slotId))));
  };

  const submit = async () => {
    if (!token || state !== 'collecting') return;
    if (needsAccessInitialization) {
      setInitializationError('면접 가능시간을 준비하고 있습니다. 잠시 후 다시 저장해주세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const allowed = new Set(visibleSlots);
      const normalized = Array.from(availability).filter((slot) => allowed.has(slot)).sort();
      await savePublicAvailability(token, normalized, access?.submittedAt == null);
      localEditRef.current = false;
      setAvailability(new Set(normalized));
      setSaved(true);
    } catch {
      setSaveError('저장하지 못했습니다. 조사 기간과 네트워크 상태를 확인해주세요. 선택 내용은 이 화면에 남아 있으니 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return {
    access,
    round,
    visibleSlots,
    availability,
    state,
    error: loadError ?? initializationError ?? saveError,
    initializingAccess: needsAccessInitialization,
    initializationError,
    saving,
    saved,
    toggleSlot,
    replaceAvailability,
    submit,
    retryInitialization,
  };
}
