import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewRound, InterviewSchedule } from '../types';
import InterviewRoundsPage from './InterviewRoundsPage';

const mocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../hooks/useInterviewRoundsLogic', () => ({ useInterviewRoundsLogic: () => mocks.value }));
vi.mock('./InterviewRoundFormModal', () => ({ default: () => null }));

const stamp = (value: string) => Timestamp.fromDate(new Date(value));
const round = {
  id: 'round-1', name: '2026년 2학기', interviewDates: [],
  surveyOpensAt: stamp('2026-08-01T00:00:00+09:00'), surveyClosesAt: stamp('2026-08-02T00:00:00+09:00'),
} as unknown as InterviewRound;
const schedule = (status: InterviewSchedule['status']) => ({
  id: 'schedule-1', roundId: round.id, name: '9월 면접', status,
  surveyOpensAt: stamp('2026-09-08T00:00:00+09:00'), surveyClosesAt: stamp('2026-09-10T00:00:00+09:00'),
} as InterviewSchedule);

describe('InterviewRoundsPage schedule summary', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T00:00:00+09:00'));
    mocks.value = { rounds: [round], countsByRound: {}, schedulesByRound: {}, loading: false, saving: false, saveRound: vi.fn() };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });
  const render = () => act(() => root.render(<MemoryRouter><InterviewRoundsPage /></MemoryRouter>));

  it('shows schedule setup only when the round has no non-archived schedules', () => {
    render();
    expect(container.textContent).toContain('일정 추가 전');
    expect(container.textContent).toContain('회차 안에서 면접 일정을 추가해주세요.');
  });

  it('uses the concrete schedule even when the legacy round dates are empty', () => {
    mocks.value.schedulesByRound = { [round.id]: [schedule('collecting'), schedule('archived')] };
    render();
    expect(container.textContent).toContain('응답 수집 중');
    expect(container.textContent).toContain('면접 일정 1개');
    expect(container.textContent).not.toContain('일정 추가 전');
  });
});
