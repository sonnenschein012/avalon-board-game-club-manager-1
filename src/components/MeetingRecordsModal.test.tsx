import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MeetingRecordsModal from './MeetingRecordsModal';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), restore: vi.fn(), view: vi.fn(), close: vi.fn(), error: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../services/dailyPlanningService', () => ({ deleteDailyPlanning: mocks.remove, restoreDailyPlanningVersion: mocks.restore }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  query: (ref: string) => ref, orderBy: vi.fn(),
  onSnapshot: (ref: string, receive: (snapshot: unknown) => void) => {
    const snapshot = { date: '2026-09-10', name: '목요 모임', groups: [{ id: 'g1', name: 'Team a', memberIds: ['m1'] }], attendees: [{ memberId: 'm1', name: '김테스트', drink: '아이스티', request: '쉬운 게임' }] };
    receive({ docs: [{ id: ref.endsWith('/versions') ? 'v1' : '2026-09-10', data: () => ref.endsWith('/versions') ? { snapshot, actorEmail: 'admin@example.com', reason: '모임 다시 시작 전', archivedAt: null } : snapshot }] });
    return vi.fn();
  },
}));

let root: Root;
let container: HTMLDivElement;
const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent === text)!;
const click = async (text: string) => act(async () => { button(text).click(); });
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.remove.mockResolvedValue(undefined);
  mocks.restore.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MeetingRecordsModal members={[]} onClose={mocks.close} onView={mocks.view} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('lists saved dates and opens the selected meeting', async () => {
  expect(container.textContent).toContain('1개 조 · 1명');
  await click('열람');
  expect(mocks.view).toHaveBeenCalledWith('2026-09-10');
});

it('requires confirmation and retains a failed deletion for retry', async () => {
  await click('삭제');
  expect(container.textContent).toContain('모든 이전 버전을 삭제');
  expect(mocks.remove).not.toHaveBeenCalled();
  const confirm = () => [...container.querySelectorAll('button')].filter(item => item.textContent === '삭제').at(-1)!;
  mocks.remove.mockRejectedValueOnce(new Error('offline'));
  await act(async () => confirm().click());
  expect(mocks.error).toHaveBeenCalled();
  expect(container.textContent).toContain('목요 모임');
  await act(async () => confirm().click());
  expect(mocks.remove).toHaveBeenCalledWith('2026-09-10');
  expect(container.textContent).toContain('저장된 모임 진행 기록이 없습니다.');
});

it('previews the old groups and details before restoring, with cancellation and failure retry', async () => {
  await click('이전 버전');
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!.click());
  expect(container.textContent).toContain('Team a');
  expect(container.textContent).toContain('아이스티');
  expect(container.textContent).toContain('쉬운 게임');
  await click('이 버전으로 복원');
  await click('취소');
  expect(mocks.restore).not.toHaveBeenCalled();
  await click('이 버전으로 복원');
  mocks.restore.mockRejectedValueOnce(new Error('offline'));
  await click('복원 확인');
  expect(mocks.error).toHaveBeenCalled();
  expect(mocks.view).not.toHaveBeenCalled();
  await click('복원 확인');
  expect(mocks.restore).toHaveBeenCalledWith('2026-09-10', 'v1');
  expect(mocks.view).toHaveBeenCalledWith('2026-09-10');
});
