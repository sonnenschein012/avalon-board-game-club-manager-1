import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useMeetingProgressLogic } from './useMeetingProgressLogic';

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), collections: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), onSnapshot: (_ref: unknown, callback: unknown) => { mocks.snapshot(callback); return vi.fn(); },
}));
vi.mock('../services/dailyPlanningService', () => ({ renameDailyPlanningGroup: vi.fn() }));
vi.mock('../services/captureService', () => ({ captureBoard: vi.fn() }));
vi.mock('./useFirestore', () => ({ useFirestore: (name: string) => { mocks.collections(name); return { data: [] }; } }));

it('reads saved meeting details by member ID without subscribing to the resettable roster', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-09T17:00:00Z'));
  const container = document.createElement('div');
  const root = createRoot(container);
  let latest: ReturnType<typeof useMeetingProgressLogic>;
  function Harness() { latest = useMeetingProgressLogic(); return null; }
  try {
    act(() => root.render(<Harness />));
    expect(latest!.selectedDate).toBe('2026-09-10');
    const receive = mocks.snapshot.mock.calls.at(-1)![0];
    act(() => receive({ exists: () => true, data: () => ({
      date: '2026-09-10', groups: [], attendees: [
        { memberId: 'm1', drink: '아이스티', request: '쉬운 게임' },
        { memberId: 'm2', drink: '커피', request: '' },
      ],
    }) }));
    expect(latest!.getAttendeeFromMember({ id: 'm1', name: '변경된 이름' } as never)?.drink).toBe('아이스티');
    expect(latest!.getAttendeeFromMember({ id: 'm2' } as never)?.drink).toBe('커피');
    expect(mocks.collections).not.toHaveBeenCalledWith('attendees');
    act(() => latest!.setSelectedDate('2026-09-11'));
    expect(latest!.attendees).toEqual([]);
    act(() => mocks.snapshot.mock.calls.at(-1)![0]({ exists: () => true, data: () => ({ date: '2026-09-11', groups: [] }) }));
    expect(latest!.attendees).toEqual([]);
  } finally {
    act(() => root.unmount());
    vi.useRealTimers();
  }
});
