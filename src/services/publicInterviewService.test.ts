import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Array<{
  path: string;
  next: (snapshot: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  onSnapshot: (reference: { path: string }, next: (snapshot: unknown) => void) => {
    const unsubscribe = vi.fn();
    listeners.push({ path: reference.path, next, unsubscribe });
    return unsubscribe;
  },
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'get', UPDATE: 'update' },
}));

import { subscribeToPublicInterview } from './publicInterviewService';

function snapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    id: 'snapshot-id',
    data: () => data ?? {},
  };
}

describe('subscribeToPublicInterview', () => {
  beforeEach(() => listeners.splice(0));

  it('같은 일정의 access 갱신은 일정 구독을 다시 만들지 않고 최신 값을 즉시 방출한다', () => {
    const values: unknown[] = [];
    const unsubscribe = subscribeToPublicInterview('token-1', value => values.push(value), vi.fn());
    expect(listeners.map(item => item.path)).toEqual(['interviewAccess/token-1']);

    listeners[0]!.next(snapshot({ active: true, roundId: 'round-1', scheduleId: 'schedule-1', availability: [] }));
    expect(listeners.map(item => item.path)).toEqual([
      'interviewAccess/token-1',
      'interviewPublicSchedules/schedule-1',
    ]);
    listeners[1]!.next(snapshot({ active: true, name: '일정' }));

    listeners[0]!.next(snapshot({ active: true, roundId: 'round-1', scheduleId: 'schedule-1', availability: ['slot-1'] }));
    expect(listeners).toHaveLength(2);
    expect(values).toHaveLength(2);
    expect(values.at(-1)).toMatchObject({ access: { availability: ['slot-1'] }, round: { name: '일정' } });
    unsubscribe();
    expect(listeners[0]!.unsubscribe).toHaveBeenCalledOnce();
    expect(listeners[1]!.unsubscribe).toHaveBeenCalledOnce();
  });

  it('일정이 바뀌면 이전 일정 구독을 해제하고 새 일정만 구독한다', () => {
    subscribeToPublicInterview('token-1', vi.fn(), vi.fn());
    listeners[0]!.next(snapshot({ active: true, roundId: 'round-1', scheduleId: 'schedule-1' }));
    const firstRoundListener = listeners[1]!;
    firstRoundListener.next(snapshot({ active: true }));

    listeners[0]!.next(snapshot({ active: true, roundId: 'round-1', scheduleId: 'schedule-2' }));
    expect(firstRoundListener.unsubscribe).toHaveBeenCalledOnce();
    expect(listeners.at(-1)?.path).toBe('interviewPublicSchedules/schedule-2');
  });
});
