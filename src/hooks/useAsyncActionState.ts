import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

export type AsyncActionStatus = 'idle' | 'pending' | 'success' | 'error';

export interface AsyncActionFeedback {
  successMessage?: string;
  errorMessage?: string;
  onError?: (error: unknown) => void;
}

export interface AsyncActionResult<T> {
  started: boolean;
  succeeded: boolean;
  value?: T | undefined;
}

/** Shared action lifecycle: one in-flight request per key, with observable status. */
export function useAsyncActionState() {
  const activeKeys = useRef(new Set<string>());
  const [statuses, setStatuses] = useState<Record<string, AsyncActionStatus>>({});

  const runExclusive = useCallback(async <T,>(key: string, action: () => Promise<T>): Promise<{ started: boolean; value?: T }> => {
    if (activeKeys.current.has(key)) return { started: false };
    activeKeys.current.add(key);
    setStatuses(current => ({ ...current, [key]: 'pending' }));
    try {
      const value = await action();
      setStatuses(current => ({ ...current, [key]: 'success' }));
      return { started: true, value };
    } catch (error) {
      setStatuses(current => ({ ...current, [key]: 'error' }));
      throw error;
    } finally {
      activeKeys.current.delete(key);
    }
  }, []);

  /**
   * Standard operator feedback for server mutations. The action remains
   * exclusive per key, while the caller can keep Firestore-specific error
   * reporting in `onError`.
   */
  const runAction = useCallback(async <T,>(
    key: string,
    action: () => Promise<T>,
    feedback: AsyncActionFeedback = {},
  ): Promise<AsyncActionResult<T>> => {
    try {
      const result = await runExclusive(key, action);
      if (!result.started) return { started: false, succeeded: false };
      if (feedback.successMessage) toast.success(feedback.successMessage);
      return { started: true, succeeded: true, value: result.value };
    } catch (error) {
      feedback.onError?.(error);
      if (feedback.errorMessage) toast.error(feedback.errorMessage);
      return { started: true, succeeded: false };
    }
  }, [runExclusive]);

  const statusOf = useCallback((key: string): AsyncActionStatus => statuses[key] ?? 'idle', [statuses]);
  const isPending = useCallback((key: string) => statuses[key] === 'pending', [statuses]);
  const anyPending = Object.values(statuses).some(status => status === 'pending');

  return { runExclusive, runAction, statusOf, isPending, anyPending };
}
