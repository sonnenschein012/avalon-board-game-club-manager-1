import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionsLogic } from './useSessionsLogic';

vi.mock('../lib/firebase', () => ({ handleFirestoreError: vi.fn(), OperationType: {} }));
vi.mock('../services/sessionsService', () => ({
  createSessionRecord: vi.fn(), deleteSessionRecord: vi.fn(),
  importSessionRecords: vi.fn(), updateSessionRecord: vi.fn(),
  updateSessionGroupGames: vi.fn(),
}));
vi.mock('./useFirestore', () => {
  const members = [{ id: 'm1' }, { id: 'm2' }];
  const empty: unknown[] = [];
  return { useFirestore: (collection: string) => ({ data: collection === 'members' ? members : empty }) };
});

describe('session assignment pool', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useSessionsLogic>;
  function Harness() {
    latest = useSessionsLogic();
    return null;
  }

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('derives available members through assignment, removal, and deletion of their group', () => {
    act(() => latest.handleAddNew());
    act(() => latest.setGroups([{ id: 'a', memberIds: [], gameIds: [] }]));
    expect(latest.unassignedIds).toEqual(['m1', 'm2']);

    act(() => latest.assignToGroup('m1', 'a'));
    expect(latest.unassignedIds).toEqual(['m2']);
    act(() => latest.removeFromGroup('m1', 'a'));
    expect(latest.unassignedIds).toEqual(['m1', 'm2']);

    act(() => latest.assignToGroup('m1', 'a'));
    act(() => latest.setGroups(groups => groups.filter(group => group.id !== 'a')));
    expect(latest.unassignedIds).toEqual(['m1', 'm2']);
  });
});
