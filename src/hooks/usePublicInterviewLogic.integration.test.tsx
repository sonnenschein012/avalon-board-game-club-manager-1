import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { unsubscribe, subscribeToPublicInterview, initializePublicInterviewAccess, savePublicAvailability, subscriptions } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const subscriptions: Array<(value: unknown) => void> = [];
  return {
    unsubscribe,
    subscriptions,
    initializePublicInterviewAccess: vi.fn(),
    savePublicAvailability: vi.fn(),
    subscribeToPublicInterview: vi.fn((_token: string, next: (value: unknown) => void) => {
      subscriptions.push(next);
      return unsubscribe;
    }),
  };
});

vi.mock('../services/publicInterviewService', () => ({
  initializePublicInterviewAccess,
  savePublicAvailability,
  subscribeToPublicInterview,
}));

import { usePublicInterviewLogic } from './usePublicInterviewLogic';

type PublicInterviewLogic = ReturnType<typeof usePublicInterviewLogic>;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
    subscriptions.splice(0);
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

  it('응답 저장은 연속 요청을 하나로 제한하고 실패하면 선택을 유지한다', async () => {
    let resolveSave!: () => void;
    savePublicAvailability.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    act(() => root.render(<Harness />));
    act(() => subscriptions[0]!({
      access: { active: true, scheduleId: 'schedule-1', firstAccessedAt: new Date(), availability: ['slot-1'] },
      round: {
        active: true,
        surveyOpensAt: { toDate: () => new Date('2020-01-01T00:00:00.000Z') },
        surveyClosesAt: { toDate: () => new Date('2030-01-01T00:00:00.000Z') },
        allowedSlots: ['slot-1'],
      },
    }));

    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = latest!.submit();
      duplicate = latest!.submit();
    });
    expect(savePublicAvailability).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSave();
      await Promise.all([first, duplicate]);
    });
    expect(latest!.saved).toBe(true);

    savePublicAvailability.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await latest!.submit(); });
    expect(latest!.saved).toBe(false);
    expect(latest!.error).toContain('저장하지 못했습니다');
  });
});
