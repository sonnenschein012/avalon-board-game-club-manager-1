import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewApplicantWithAccess, InterviewRound } from '../types';

const { flush } = vi.hoisted(() => ({ flush: vi.fn() }));
vi.mock('../hooks/useInterviewNoteLogic', () => ({
  useInterviewNoteLogic: () => ({
    flush, state: 'saved', generalNotes: '보존할 메모', answers: {}, overallRating: null,
    setGeneralNotes: vi.fn(), setAnswer: vi.fn(), setOverallRating: vi.fn(),
    acceptRemote: vi.fn(), overwriteRemote: vi.fn(), retrySave: vi.fn(),
  }),
}));
import InterviewWorkspaceModal from './InterviewWorkspaceModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('InterviewWorkspaceModal 저장 확인', () => {
  let root: Root;
  let container: HTMLDivElement;
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const onActionNeeded = vi.fn();
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent === text)!;
  const close = () => container.querySelector<HTMLButtonElement>('[aria-label="면접 화면 닫기"]')!;

  beforeEach(() => {
    vi.clearAllMocks();
    flush.mockResolvedValue({ saved: true, revision: 1 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<InterviewWorkspaceModal
      applicant={{ id: 'A', name: '지원자', applicationData: [] } as unknown as InterviewApplicantWithAccess}
      round={{ id: 'round', availabilitySlotMinutes: 30, interviewQuestions: [] } as unknown as InterviewRound}
      interviewer={null} onClose={onClose} onComplete={onComplete} onActionNeeded={onActionNeeded}
    />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('저장이 끝날 때까지 닫기와 입력을 막고 성공하면 한 번 닫는다', async () => {
    let resolve!: (value: { saved: boolean; revision: number }) => void;
    flush.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => { close().click(); close().click(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(close().disabled).toBe(true);
    expect(container.querySelector('fieldset')!.disabled).toBe(true);
    expect(container.textContent).toContain('저장 확인 중');
    await act(async () => { resolve({ saved: true, revision: 2 }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('저장 실패 시 메모와 화면을 유지하고 닫기를 다시 시도할 수 있다', async () => {
    flush.mockResolvedValueOnce({ saved: false, revision: 0 });
    await act(async () => { close().click(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('textarea')!.value).toBe('보존할 메모');
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('입력 내용은 유지됩니다');
    expect(close().disabled).toBe(false);
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
    await act(async () => { close().click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('조치 필요 이동도 메모 저장 실패 시 진행하지 않는다', async () => {
    flush.mockResolvedValueOnce({ saved: false, revision: 0 });
    act(() => button('조치 필요').click());
    await act(async () => { button('조치 필요로 이동').click(); });
    expect(onActionNeeded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('textarea')!.value).toBe('보존할 메모');
  });
});
