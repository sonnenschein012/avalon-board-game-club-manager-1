import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewNote, InterviewRoundInterviewer } from '../types';

const { listeners, saveInterviewNote, subscribeInterviewNote } = vi.hoisted(() => {
  const listeners: Array<(note: unknown) => void> = [];
  return {
    listeners,
    saveInterviewNote: vi.fn(),
    subscribeInterviewNote: vi.fn((_roundId: string, _applicantId: string, next: (note: unknown) => void) => {
      listeners.push(next);
      return vi.fn();
    }),
  };
});

vi.mock('../services/interviewsService', () => ({ saveInterviewNote, subscribeInterviewNote }));

import { useInterviewNoteLogic } from './useInterviewNoteLogic';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const interviewer = {
  interviewerId: 'interviewer-1',
  displayName: '면접관',
} as InterviewRoundInterviewer;

const remoteNote = (revision: number, generalNotes: string) => ({
  id: 'round-1__applicant-1',
  roundId: 'round-1',
  applicantId: 'applicant-1',
  interviewerId: 'interviewer-2',
  interviewerName: '다른 면접관',
  generalNotes,
  answers: {},
  overallRating: null,
  revision,
} as InterviewNote);

describe('useInterviewNoteLogic', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useInterviewNoteLogic>;

  function Harness() {
    latest = useInterviewNoteLogic('round-1', 'applicant-1', interviewer);
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    listeners.splice(0);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('작성 중 새 원격 리비전이 오면 로컬 입력을 보존하고 충돌로 표시한다', () => {
    act(() => listeners[0]!(remoteNote(1, '서버 원본')));
    act(() => latest!.setGeneralNotes('내 작성 중 내용'));
    act(() => listeners[0]!(remoteNote(2, '다른 운영진 수정')));

    expect(latest!.state).toBe('conflict');
    expect(latest!.generalNotes).toBe('내 작성 중 내용');

    act(() => latest!.acceptRemote());
    expect(latest!.state).toBe('saved');
    expect(latest!.generalNotes).toBe('다른 운영진 수정');
    expect(latest!.revision).toBe(2);
  });

  it('자동 저장에 현재 리비전을 전달하고 성공한 리비전을 반영한다', async () => {
    saveInterviewNote.mockResolvedValueOnce(2);
    act(() => listeners[0]!(remoteNote(1, '서버 원본')));
    act(() => latest!.setGeneralNotes('내 수정'));

    await act(async () => {
      vi.advanceTimersByTime(700);
      await vi.runAllTimersAsync();
    });

    expect(saveInterviewNote).toHaveBeenCalledWith(expect.objectContaining({
      generalNotes: '내 수정',
      expectedRevision: 1,
    }));
    expect(latest!.state).toBe('saved');
    expect(latest!.revision).toBe(2);
  });

  it('충돌 후 명시적으로 내 입력을 선택하면 최신 원격 리비전 위에 저장한다', async () => {
    saveInterviewNote.mockResolvedValueOnce(3);
    act(() => listeners[0]!(remoteNote(1, '서버 원본')));
    act(() => latest!.setGeneralNotes('보존할 내 입력'));
    act(() => listeners[0]!(remoteNote(2, '다른 운영진 수정')));

    await act(async () => { await latest!.overwriteRemote(); });

    expect(saveInterviewNote).toHaveBeenCalledWith(expect.objectContaining({
      generalNotes: '보존할 내 입력',
      expectedRevision: 2,
    }));
    expect(latest!.state).toBe('saved');
    expect(latest!.revision).toBe(3);
  });
});
