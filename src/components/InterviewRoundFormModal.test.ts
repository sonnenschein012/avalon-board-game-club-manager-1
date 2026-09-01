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
      selected: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님의 5기 신입부원 선발이 확정되어 안내드립니다. 축하드립니다!\n아발론 활동을 위한 회비 납부를 부탁드립니다.\n\n💰 회비: {회비 금액}\n🏦 입금 계좌: {은행} {계좌번호}\n👤 예금주: {예금주}\n\n입금자명은 지원자 본인 이름으로 부탁드리며, 다른 이름으로 입금하신 경우 알려주세요.\n회비 납부가 확인되면 아발론 카카오톡 공지방으로 초대드릴 예정입니다.\n\n지원해 주셔서 감사드리며, 앞으로 잘 부탁드립니다! 🎲',
      rejected: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 이번 5기 신입부원 모집에 지원해 주셔서 감사합니다.\n아쉽게도 이번 모집에서는 함께하지 못하게 되었습니다.\n\n아발론에 관심을 가지고 지원해 주신 점 다시 한번 감사드립니다.',
    });
  });

  it('keeps persisted settings and all message templates unchanged in edit mode', () => {
    const messageTemplates = {
      availability: '저장된 조사 안내 {link}',
      reminder: '저장된 재안내 {deadline}',
      confirmation: '저장된 확정 안내 {interviewDate}',
      reschedule: '저장된 일정 변경 안내 {oldInterviewDate}',
      selected: '저장된 선발 안내 {name}',
      rejected: '저장된 미선발 안내 {name}',
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
    expect(draft.messageTemplates).toEqual(messageTemplates);
    expect(draft.messageTemplates.reschedule).toBe(messageTemplates.reschedule);
  });

  it('adds decision-message defaults to rounds saved before those templates existed', () => {
    const round = {
      name: '과거 회차',
      surveyOpensAt: { toDate: () => new Date('2026-08-27T00:00:00.000Z') },
      surveyClosesAt: { toDate: () => new Date('2026-09-03T00:00:00.000Z') },
      messageTemplates: {
        availability: '기존 조사 안내',
        reminder: '기존 재안내',
        confirmation: '기존 확정 안내',
        reschedule: '기존 변경 안내',
      },
    } as unknown as InterviewRound;

    const draft = roundToDraft(round);

    expect(draft.messageTemplates.selected).toContain('{name} 님의 5기 신입부원 선발이 확정');
    expect(draft.messageTemplates.rejected).toContain('이번 5기 신입부원 모집에 지원');
  });
});
