import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterviewApplicant, InterviewApplicantWithAccess, InterviewRoundInterviewer, InterviewSchedule } from '../../types';

const { saveInterviewAssignment } = vi.hoisted(() => ({ saveInterviewAssignment: vi.fn() }));
vi.mock('../../services/interviewsService', () => ({
  saveInterviewAssignment,
  applyInterviewAssignmentProposals: vi.fn(),
  updateInterviewAssignmentState: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useInterviewAssignmentLogic } from './useInterviewAssignmentLogic';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const slot = '2026-09-03|19:00';
const initialApplicant = {
  id: 'applicant-1',
  name: '지원자',
  scheduleId: 'schedule-1',
  assignment: null,
  assignmentRevision: 3,
  confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
  access: { availability: [slot], submittedAt: Timestamp.fromMillis(1) },
  link: '/interview/token',
} as InterviewApplicantWithAccess;
const schedule = {
  id: 'schedule-1', name: '면접 일정', availabilitySlotMinutes: 30, assignmentSlotMinutes: 30,
} as InterviewSchedule;
const interviewer = {
  interviewerId: 'interviewer-1', displayName: '면접관', availability: [slot], active: true,
} as InterviewRoundInterviewer;

describe('interview assignment state ownership', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useInterviewAssignmentLogic>;
  let visibleApplicant: InterviewApplicantWithAccess;
  let replaceApplicant: (value: InterviewApplicant) => void;

  function Harness() {
    const [applicants, setApplicants] = useState<InterviewApplicant[]>([initialApplicant]);
    const joinedApplicants = applicants.map(applicant => ({
      ...applicant, access: initialApplicant.access, link: initialApplicant.link,
    }));
    visibleApplicant = joinedApplicants[0]!;
    replaceApplicant = applicant => setApplicants([applicant]);
    latest = useInterviewAssignmentLogic('round-1', {
      activeSchedule: schedule,
      activeScheduleId: schedule.id,
      activeSchedulingConfig: schedule,
      activeInterviewers: [interviewer],
      joinedApplicants,
      applicantById: new Map(applicants.map(applicant => [applicant.id, applicant])),
      joinedApplicantById: new Map(joinedApplicants.map(applicant => [applicant.id, applicant])),
      setApplicants,
      changeRequests: [],
    });
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it.each([false, true])('rolls back a failed save without replacing a newer snapshot (new snapshot: %s)', async hasNewSnapshot => {
    let rejectSave!: (error: Error) => void;
    saveInterviewAssignment.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
    let saveTask!: Promise<boolean>;
    act(() => { saveTask = latest.assignApplicant(visibleApplicant, slot, interviewer.interviewerId); });

    expect(visibleApplicant.assignment?.slotId).toBe(slot);
    expect(visibleApplicant.assignmentRevision).toBe(4);
    expect(saveInterviewAssignment).toHaveBeenCalledWith(initialApplicant.id, expect.objectContaining({
      slotId: slot, scheduleId: schedule.id, interviewerId: interviewer.interviewerId,
    }), 3);

    const remoteApplicant = { ...initialApplicant, assignmentRevision: 5, name: '서버에서 수정된 지원자' };
    if (hasNewSnapshot) act(() => replaceApplicant(remoteApplicant));
    await act(async () => {
      rejectSave(new Error('save failed'));
      expect(await saveTask).toBe(false);
    });

    expect(visibleApplicant).toEqual(hasNewSnapshot ? remoteApplicant : initialApplicant);
  });
});
