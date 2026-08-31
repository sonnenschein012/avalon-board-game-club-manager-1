import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewSchedule } from '../types';
import InterviewScheduleAssignmentModal from './InterviewScheduleAssignmentModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const schedule = (id: string, name: string, date: string) => ({
  id,
  name,
  status: 'collecting',
  interviewDates: [date],
} as InterviewSchedule);

describe('InterviewScheduleAssignmentModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T03:00:00Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('모레 시작 일정을 추천 표시하고 기본 선택한다', () => {
    act(() => root.render(
      <InterviewScheduleAssignmentModal
        open
        applicantsCount={3}
        schedules={[
          schedule('tomorrow', '내일 일정', '2026-09-01'),
          schedule('preferred', '모레 일정', '2026-09-02'),
          schedule('three-days', '3일 후 일정', '2026-09-03'),
        ]}
        onClose={vi.fn()}
        onAssign={vi.fn(async () => true)}
        onCreateSchedule={vi.fn()}
      />,
    ));

    const selected = container.querySelector<HTMLInputElement>('input[value="preferred"]');
    const recommendedLabel = Array.from(container.querySelectorAll('label')).find(label => label.textContent?.includes('추천'));
    expect(selected?.checked).toBe(true);
    expect(recommendedLabel?.textContent).toContain('모레 일정');
  });
});
