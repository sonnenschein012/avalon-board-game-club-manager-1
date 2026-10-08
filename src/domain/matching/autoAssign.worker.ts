import { simulateAutoAssign, type AutoAssignInput } from './autoAssignAlgorithm';
self.onmessage = (event: MessageEvent<AutoAssignInput>) => {
  try { self.postMessage({ result: simulateAutoAssign(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '자동 편성에 실패했습니다.' }); }
};
