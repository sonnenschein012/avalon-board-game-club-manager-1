import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewApplicantWithAccess, InterviewRound, InterviewSelectionStatus } from '../types';
import SelectionDetailModal from './SelectionDetailModal';
import SelectionPanel from './SelectionPanel';

vi.mock('../hooks/useInterviewNoteLogic', () => ({
  useInterviewNoteLogic: () => ({ generalNotes: '', answers: {} }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const round = { id: 'round-1', interviewQuestions: [] } as unknown as InterviewRound;

function applicant(id: string, selectionStatus?: InterviewSelectionStatus): InterviewApplicantWithAccess {
  return {
    id,
    name: `지원자 ${id}`,
    applicantNumber: id,
    interviewStatus: 'completed',
    selectionStatus,
  } as InterviewApplicantWithAccess;
}

function decisionButtons(container: HTMLElement) {
  const articles = Array.from(container.querySelectorAll('article'));
  return articles.map(article => {
    const buttons = Array.from(article.querySelectorAll('button'));
    return {
      rejected: buttons.find(button => button.textContent?.trim() === '미선발') as HTMLButtonElement,
      selected: buttons.find(button => button.textContent?.trim() === '선발') as HTMLButtonElement,
    };
  });
}

describe('selection decision buttons', () => {
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

  it('uses the selected decision color and keeps the other list decision neutral', () => {
    act(() => root.render(
      <SelectionPanel
        round={round}
        applicants={[applicant('1-pending'), applicant('2-selected', 'selected'), applicant('3-rejected', 'rejected')]}
        onUpdateSelectionStatus={vi.fn(async () => true)}
        onUpdateOverallRating={vi.fn(async () => true)}
        onReopenCompletedInterview={vi.fn(async () => true)}
      />,
    ));

    const allApplicantsButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('전체 면접 완료'));
    act(() => allApplicantsButton?.click());

    const buttons = decisionButtons(container);
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.rejected.className).toContain('bg-white');
    expect(buttons[0]!.selected.className).toContain('bg-white');
    expect(buttons[1]!.selected.className).toContain('bg-emerald-600');
    expect(buttons[1]!.rejected.className).toContain('bg-white');
    expect(buttons[2]!.rejected.className).toContain('bg-red-600');
    expect(buttons[2]!.selected.className).toContain('bg-white');
  });

  it('uses the same decision color model in the detail modal', () => {
    act(() => root.render(
      <SelectionDetailModal
        applicant={applicant('pending')}
        round={round}
        onClose={vi.fn()}
        onUpdateSelectionStatus={vi.fn(async () => true)}
        onUpdateOverallRating={vi.fn(async () => true)}
        onReopenCompletedInterview={vi.fn(async () => true)}
      />,
    ));

    const modalButtons = () => Array.from(container.querySelectorAll('footer button'));
    const rejected = () => modalButtons().find(button => button.textContent?.trim() === '미선발') as HTMLButtonElement;
    const selected = () => modalButtons().find(button => button.textContent?.trim() === '선발') as HTMLButtonElement;

    expect(rejected().className).toContain('bg-white');
    expect(selected().className).toContain('bg-white');

    act(() => root.render(
      <SelectionDetailModal
        applicant={applicant('selected', 'selected')}
        round={round}
        onClose={vi.fn()}
        onUpdateSelectionStatus={vi.fn(async () => true)}
        onUpdateOverallRating={vi.fn(async () => true)}
        onReopenCompletedInterview={vi.fn(async () => true)}
      />,
    ));
    expect(selected().className).toContain('bg-emerald-600');
    expect(rejected().className).toContain('bg-white');
    expect(container.textContent).toContain('지원자 selected 님의 5기 신입부원 선발이 확정');

    act(() => root.render(
      <SelectionDetailModal
        applicant={applicant('rejected', 'rejected')}
        round={round}
        onClose={vi.fn()}
        onUpdateSelectionStatus={vi.fn(async () => true)}
        onUpdateOverallRating={vi.fn(async () => true)}
        onReopenCompletedInterview={vi.fn(async () => true)}
      />,
    ));
    expect(rejected().className).toContain('bg-red-600');
    expect(selected().className).toContain('bg-white');
    expect(container.textContent).toContain('지원자 rejected 님, 이번 5기 신입부원 모집에 지원');
  });
});
