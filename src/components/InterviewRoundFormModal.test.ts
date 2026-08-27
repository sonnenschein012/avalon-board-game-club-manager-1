import { describe, expect, it } from 'vitest';
import type { InterviewRound } from '../types';
import { roundToDraft } from './InterviewRoundFormModal';

describe('new interview round defaults', () => {
  it('uses the full applicant instructions and message templates', () => {
    const draft = roundToDraft();

    expect(draft.instructions).toBe('선택해 주신 시간 중 운영진이 면접 시간을 배정한 뒤 문자로 안내드릴 예정입니다.\n\n시간표의 칸을 누르거나 드래그하여 여러 시간을 한 번에 선택할 수 있습니다.');
    expect(draft.messageTemplates).toEqual({
      availability: '{name} 님의 면접 가능 시간을 {deadline}까지 선택해주세요. {link}',
      reminder: '{name} 님, 아직 면접 가능 시간 응답이 확인되지 않았습니다. {deadline}까지 제출해주세요. {link}',
      confirmation: '{name} 님의 면접 시간이 {interviewDate} {interviewTime}으로 확정되었습니다.',
      reschedule: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 요청하신 일정 조정에 따라 면접 일정이 변경되어 안내드립니다.\n\n기존: {oldInterviewDate} {oldInterviewTime}\n변경: {interviewDate} {interviewTime}\n☎️ 담당 면접관 {interviewerName} · {interviewerPhone}\n\n위 번호로 전화드릴 예정입니다. 확인 부탁드립니다!',
    });
  });

  it('keeps persisted settings and all message templates unchanged in edit mode', () => {
    const messageTemplates = {
      availability: '저장된 조사 안내 {link}',
      reminder: '저장된 재안내 {deadline}',
      confirmation: '저장된 확정 안내 {interviewDate}',
      reschedule: '저장된 일정 변경 안내 {oldInterviewDate}',
    };
    const round = {
      id: 'round-1',
      name: '저장된 회차',
      surveyOpensAt: { toDate: () => new Date('2026-08-27T00:00:00.000Z') },
      surveyClosesAt: { toDate: () => new Date('2026-09-03T00:00:00.000Z') },
      interviewDates: ['2026-09-05'],
      dayStartTime: '10:00',
      dayEndTime: '18:00',
      availabilitySlotMinutes: 30,
      assignmentSlotMinutes: 10,
      status: 'closed',
      instructions: '저장된 지원자 안내문',
      messageTemplates,
      interviewQuestions: [],
      allowedSlots: [],
      daySchedules: [],
    } as unknown as InterviewRound;

    const draft = roundToDraft(round);

    expect(draft.instructions).toBe(round.instructions);
    expect(draft.messageTemplates).toBe(messageTemplates);
    expect(draft.messageTemplates.reschedule).toBe(messageTemplates.reschedule);
  });
});
