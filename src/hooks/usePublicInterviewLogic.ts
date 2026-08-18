import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewAccess, InterviewPublicRound } from '../types';
import { requestPublicInterviewChange, savePublicAvailability, subscribeToPublicInterview } from '../services/publicInterviewService';
import { getSurveyPhase } from '../domain/interviews/scheduling';

type PublicInterviewState = 'loading' | 'invalid' | 'inactive' | 'before' | 'collecting' | 'closed' | 'error';

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

export function getPublicInterviewState(access: InterviewAccess | null, round: InterviewPublicRound | null, now: Date): PublicInterviewState {
  if (!access) return 'invalid';
  if (!access.active || !round?.active) return 'inactive';
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

export function usePublicInterviewLogic(token: string | undefined) {
  const [access, setAccess] = useState<InterviewAccess | null>(null);
  const [round, setRound] = useState<InterviewPublicRound | null>(null);
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const localEditRef = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    return subscribeToPublicInterview(
      token,
      (value) => {
        setAccess(value.access);
        setRound(value.round);
        if (!localEditRef.current) {
          setAvailability(new Set(value.access?.availability ?? []));
        }
        setLoading(false);
        setLoadError(null);
      },
      () => {
        setLoadError('면접 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
      },
    );
  }, [token]);

  const state = useMemo<PublicInterviewState>(() => {
    if (loading) return 'loading';
    if (loadError) return 'error';
    return getPublicInterviewState(access, round, now);
  }, [access, loadError, loading, now, round]);

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

  const submit = async () => {
    if (!token || state !== 'collecting') return;
    setSaving(true);
    setSaveError(null);
    try {
      const allowed = new Set(round?.allowedSlots ?? []);
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

  const requestChange = async (reason: string) => {
    if (!token || !access?.assignmentSummary || requestingChange) return false;
    setRequestingChange(true);
    try { await requestPublicInterviewChange(token, access, reason); return true; }
    catch { setSaveError('변경 요청을 보내지 못했습니다. 잠시 후 다시 시도해주세요.'); return false; }
    finally { setRequestingChange(false); }
  };

  return {
    access,
    round,
    availability,
    state,
    error: loadError ?? saveError,
    saving,
    requestingChange,
    saved,
    toggleSlot,
    submit,
    requestChange,
  };
}
