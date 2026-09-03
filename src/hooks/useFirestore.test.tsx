import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFirestore } from './useFirestore';

const firestore = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  handleFirestoreError: firestore.reportError,
  OperationType: { LIST: 'list' },
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  orderBy: (field: string, direction: string) => ({ field, direction }),
  query: (reference: unknown, ...constraints: unknown[]) => ({ reference, constraints }),
  onSnapshot: firestore.subscribe,
}));

describe('useFirestore collection subscriptions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useFirestore<{ id: string; name: string }>>;

  function Harness({ collection = 'members', direction = 'asc' }: {
    collection?: string;
    direction?: 'asc' | 'desc';
  }) {
    latest = useFirestore<{ id: string; name: string }>(collection, 'name', direction);
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    firestore.subscribe.mockReturnValue(firestore.unsubscribe);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps one listener on rerender and replaces it when collection or ordering changes', () => {
    act(() => root.render(<Harness />));
    act(() => root.render(<Harness />));
    expect(firestore.subscribe).toHaveBeenCalledTimes(1);

    act(() => root.render(<Harness direction="desc" />));
    expect(firestore.unsubscribe).toHaveBeenCalledTimes(1);
    expect(firestore.subscribe.mock.calls[1]?.[0]).toEqual({
      reference: { collection: 'members' },
      constraints: [{ field: 'name', direction: 'desc' }],
    });

    act(() => root.render(<Harness collection="games" direction="desc" />));
    expect(firestore.unsubscribe).toHaveBeenCalledTimes(2);
    expect(firestore.subscribe).toHaveBeenCalledTimes(3);
  });

  it('publishes snapshot documents and completes loading on errors', () => {
    act(() => root.render(<Harness />));
    expect(latest.loading).toBe(true);
    const subscription = firestore.subscribe.mock.calls[0]!;
    act(() => subscription[1]({ docs: [{ id: 'member-1', data: () => ({ name: '가온' }) }] }));
    expect(latest).toEqual({ data: [{ id: 'member-1', name: '가온' }], loading: false });

    const error = new Error('permission denied');
    act(() => subscription[2](error));
    expect(firestore.reportError).toHaveBeenCalledWith(error, 'list', 'members');
    expect(latest.loading).toBe(false);
  });
});
