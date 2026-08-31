import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewSchedule } from '../types';
import InterviewScheduleSelector from './InterviewScheduleSelector';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const schedule = (id: string, name: string, dates: string[], order: number) => ({
  id,
  name,
  interviewDates: dates,
  order,
  status: 'collecting',
} as InterviewSchedule);

describe('InterviewScheduleSelector', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('입력 순서와 관계없이 면접 시작 날짜순으로 표시한다', () => {
    act(() => root.render(
      <InterviewScheduleSelector
        schedules={[
          schedule('late', '늦은 일정', ['2026-09-05'], 1),
          schedule('early', '이른 일정', ['2026-09-03', '2026-09-01'], 2),
        ]}
        activeScheduleId={null}
        onSelect={vi.fn()}
      />,
    ));

    act(() => container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')?.click());
    const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining('이른 일정'),
      expect.stringContaining('늦은 일정'),
    ]);
    expect(options[0]?.textContent).toContain('09/01–09/03');
  });

  it('일정을 선택하지 않으면 면접관 명부를 기본값으로 표시할 수 있다', () => {
    act(() => root.render(
      <InterviewScheduleSelector
        schedules={[]}
        activeScheduleId={null}
        allowNone
        noneLabel="면접관 명부"
        onSelect={vi.fn()}
      />,
    ));

    expect(container.querySelector('button[aria-haspopup="listbox"]')?.textContent).toContain('면접관 명부');
  });
});
