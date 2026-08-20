import { describe, expect, it } from 'vitest';
import { roundToDraft } from './InterviewRoundFormModal';

describe('new interview round defaults', () => {
  it('uses the full applicant instructions and message templates', () => {
    const draft = roundToDraft();

    expect(draft.instructions).toBe('선택해 주신 시간 중 운영진이 면접 시간을 배정한 뒤 문자로 안내드릴 예정입니다.\n\n시간표의 칸을 누르거나 드래그하여 여러 시간을 한 번에 선택할 수 있습니다.');
    expect(draft.messageTemplates).toEqual({
      availability: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 아발론에 지원해 주셔서 감사합니다!\n전화 면접 일정 조율을 위해 {deadline}까지 아래 링크에서 가능한 시간을 선택 후 저장해 주세요.\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 다시 안내드리겠습니다.',
      reminder: '{name} 님, 아직 면접 가능 시간이 선택되지 않아 다시 한번 안내드립니다.\n\n{deadline}까지 아래 링크에서 가능한 시간을 모두 선택해 주세요!\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 안내드리겠습니다.',
      confirmation: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 예정된 면접 일정을 다시 한번 안내드립니다.\n\n📅 {interviewDate} {interviewTime}\n\n해당 시간에 전화드릴 예정이니 편하게 받아주세요. 곧 뵙겠습니다!',
      reschedule: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 요청하신 일정 조정에 따라 면접 일정이 변경되어 안내드립니다.\n\n기존: {oldInterviewDate} {oldInterviewTime}\n변경: {interviewDate} {interviewTime}\n\n변경된 시간에 전화드리겠습니다. 확인 부탁드립니다!',
    });
  });
});
