import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import SessionFormModal from './SessionFormModal';
import type { StoredSessionGroup } from '../types';
const drag = vi.hoisted(() => ({ end: undefined as undefined | ((event: unknown) => void), ids: [] as string[] }));
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (event: unknown) => void }) => { drag.end = onDragEnd; return children; },
  useDraggable: ({ id }: { id: string }) => { drag.ids.push(id); return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }; },
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  MouseSensor: {}, TouchSensor: {}, useSensor: () => ({}), useSensors: () => [],
}));
let root: Root, container: HTMLDivElement;
function Fixture() {
  const [groups, setGroups] = useState<StoredSessionGroup[]>([
    { id: 'one', name: '1조', memberIds: ['m1'], guestCount: 2, gameIds: ['game'] },
    { id: 'two', name: '2조', memberIds: [], gameIds: [] },
  ]);
  return <><output>{JSON.stringify(groups)}</output><SessionFormModal
    modalControl={{ isAdding: true, editingSessionId: 'session', handleClose: vi.fn(), handleSave: vi.fn() }}
    sessionData={{ sessionName: '세션', sessionDate: '2026-10-01', setSessionName: vi.fn(), setSessionDate: vi.fn() }}
    coreData={{ members: [], games: [], groups, setGroups, unassignedIds: [] }}
    groupActions={{ assignToGroup: vi.fn(), updateGroupName: vi.fn(), toggleGameInGroup: vi.fn(), removeFromGroup: vi.fn(), handleCreateGroup: vi.fn() }}
    dndHandlers={{ onDragEnd: vi.fn() }} /></>;
}
const data = () => JSON.parse(container.querySelector('output')!.textContent!) as StoredSessionGroup[];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  drag.ids = []; container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); act(() => root.render(<Fixture />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it('restores guest tags, keeps source reusable across groups, removes one tag, and leaves real members/games intact', () => {
  expect(container.querySelectorAll('[aria-label="게스트 제거"]')).toHaveLength(2);
  expect(new Set(drag.ids).size).toBe(drag.ids.length);
  const add = (name: string) => act(() => container.querySelector<HTMLButtonElement>(`[aria-label="${name}에 게스트 추가"]`)!.click());
  add('1조'); add('1조'); add('2조');
  expect(data().map(g => g.guestCount)).toEqual([4, 1]);
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="게스트 제거"]')!.click());
  expect(data()[0]).toMatchObject({ guestCount: 3, memberIds: ['m1'], gameIds: ['game'] });
  expect(container.querySelector('[aria-label="1조에 게스트 추가"]')).not.toBeNull();
  expect(container.querySelector('input[type="number"]')).toBeNull();
});
it('moves a guest independently between groups and removes it when dropped back into the pool', () => {
  act(() => drag.end!({ active: { id: 'session-guest-one-0', data: { current: { source: 'one', guest: true } } }, over: { id: 'two' } }));
  expect(data().map(g => g.guestCount)).toEqual([1, 1]);
  act(() => drag.end!({ active: { id: 'session-guest-two-0', data: { current: { source: 'two', guest: true } } }, over: { id: 'unassigned' } }));
  expect(data().map(g => g.guestCount)).toEqual([1, 0]);
});
