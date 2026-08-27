import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncActionState } from './useAsyncActionState';

type AsyncActionState = ReturnType<typeof useAsyncActionState>;

describe('useAsyncActionState', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: AsyncActionState;

  function Harness() {
    latest = useAsyncActionState();
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('같은 키를 연속 실행하면 진행 중인 요청 하나만 시작한다', async () => {
    let resolve!: () => void;
    const request = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    let first!: Promise<{ started: boolean; value?: void }>;
    let duplicate!: Promise<{ started: boolean; value?: void }>;

    act(() => {
      first = latest!.runExclusive('save', request);
      duplicate = latest!.runExclusive('save', request);
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(latest!.isPending('save')).toBe(true);
    await expect(duplicate).resolves.toEqual({ started: false });

    await act(async () => {
      resolve();
      await first;
    });
    expect(latest!.statusOf('save')).toBe('success');
  });

  it('실패한 요청은 오류 상태로 남기고 다음 재시도를 허용한다', async () => {
    await act(async () => {
      await expect(latest!.runExclusive('save', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    });
    expect(latest!.statusOf('save')).toBe('error');

    await act(async () => {
      await latest!.runExclusive('save', async () => undefined);
    });
    expect(latest!.statusOf('save')).toBe('success');
  });
});
