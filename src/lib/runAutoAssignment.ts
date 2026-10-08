import type { AutoAssignInput, AutoAssignResult } from '../domain/matching/autoAssignAlgorithm';

/** Keep optimization off the UI thread; abort when its draft inputs change. */
export function runAutoAssignment(input: AutoAssignInput, signal: AbortSignal): Promise<AutoAssignResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('취소됨', 'AbortError')); return; }
    const worker = new Worker(new URL('../domain/matching/autoAssign.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('취소됨', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: AutoAssignResult; error?: string }>) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error || '자동 편성에 실패했습니다.'));
    };
    worker.onerror = () => { cleanup(); reject(new Error('자동 편성 작업을 실행하지 못했습니다. 다시 시도해주세요.')); };
    try { worker.postMessage(input); } catch (error) { cleanup(); reject(error); }
  });
}
