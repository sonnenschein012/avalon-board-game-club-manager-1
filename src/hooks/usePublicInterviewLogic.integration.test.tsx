import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { unsubscribe, subscribeToPublicInterview } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return { unsubscribe, subscribeToPublicInterview: vi.fn(() => unsubscribe) };
});

vi.mock('../services/publicInterviewService', () => ({
  initializePublicInterviewAccess: vi.fn(),
  savePublicAvailability: vi.fn(),
  subscribeToPublicInterview,
}));

import { usePublicInterviewLogic } from './usePublicInterviewLogic';

type PublicInterviewLogic = ReturnType<typeof usePublicInterviewLogic>;

describe('usePublicInterviewLogic connection recovery', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: PublicInterviewLogic;

  function Harness() {
    latest = usePublicInterviewLogic('public-token');
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('초기 구독이 오래 응답하지 않으면 오류를 표시하고 재시도 때 새로 구독한다', () => {
    act(() => root.render(<Harness />));
    expect(latest!.state).toBe('loading');

    act(() => vi.advanceTimersByTime(10_000));
    expect(latest!.state).toBe('error');
    expect(latest!.error).toContain('연결이 지연');

    act(() => latest!.retryInitialization());
    expect(latest!.state).toBe('loading');
    expect(subscribeToPublicInterview).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
