import { describe, expect, it } from 'vitest';
import { haveInterviewQuestionsChanged } from './interviewQuestions';

const questions = [
  { id: 'motivation', text: '지원 동기는 무엇인가요?' },
  { id: 'experience', text: '보드게임 경험을 알려주세요.' },
];

describe('haveInterviewQuestionsChanged', () => {
  it('returns false for an unchanged question list', () => {
    expect(haveInterviewQuestionsChanged(questions, questions.map(item => ({ ...item })))).toBe(false);
  });

  it.each([
    [[...questions, { id: 'schedule', text: '활동 가능 시간은?' }]],
    [[questions[0]!]],
    [[questions[1]!, questions[0]!]],
    [[questions[0]!, { ...questions[1]!, text: '수정된 질문' }]],
  ])('detects additions, removals, reordering, and text edits', (next) => {
    expect(haveInterviewQuestionsChanged(questions, next)).toBe(true);
  });
});
