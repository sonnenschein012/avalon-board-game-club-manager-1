import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runAutoAssignment } from './runAutoAssignment';
import { REVIEW_PARAMETERS } from '../domain/matching/personalUtility';
import type { AutoAssignInput } from '../domain/matching/autoAssignAlgorithm';

class TestWorker {
  static last: TestWorker;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { TestWorker.last = this; }
}
const input: AutoAssignInput = {
  availableIds: [], initialGroups: [],
  context: { people: new Map(), requests: new Map(), absentRequests: [], exposures: new Map(), parameters: REVIEW_PARAMETERS },
};
beforeEach(() => vi.stubGlobal('Worker', TestWorker));
afterEach(() => vi.unstubAllGlobals());

it('terminates pending work on input cancellation and rejects late results', async () => {
  const controller = new AbortController();
  const promise = runAutoAssignment(input, controller.signal);
  const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  TestWorker.last.onmessage?.({ data: { result: { updatedGroups: [] } } } as MessageEvent);
  await rejected;
  expect(TestWorker.last.terminate).toHaveBeenCalled();
});

it('surfaces domain errors and disposes the worker', async () => {
  const promise = runAutoAssignment(input, new AbortController().signal);
  TestWorker.last.onmessage?.({ data: { error: '조 수를 조정해주세요.' } } as MessageEvent);
  await expect(promise).rejects.toThrow('조 수를 조정해주세요.');
  expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
});

it('surfaces worker load failures without applying an incomplete result', async () => {
  const promise = runAutoAssignment(input, new AbortController().signal);
  TestWorker.last.onerror?.();
  await expect(promise).rejects.toThrow('자동 편성 작업을 실행하지 못했습니다.');
  expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
});
