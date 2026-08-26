import { useCallback, useRef, useState } from 'react';

export type AsyncActionStatus = 'idle' | 'pending' | 'success' | 'error';

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

  const statusOf = useCallback((key: string): AsyncActionStatus => statuses[key] ?? 'idle', [statuses]);
  const isPending = useCallback((key: string) => statuses[key] === 'pending', [statuses]);
  const anyPending = Object.values(statuses).some(status => status === 'pending');

  return { runExclusive, statusOf, isPending, anyPending };
}
