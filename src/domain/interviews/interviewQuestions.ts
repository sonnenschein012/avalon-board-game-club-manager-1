import type { InterviewQuestion } from '../../types';

export function haveInterviewQuestionsChanged(
  current: readonly InterviewQuestion[],
  next: readonly InterviewQuestion[],
): boolean {
  if (current.length !== next.length) return true;
  return current.some((question, index) => {
    const nextQuestion = next[index];
    return !nextQuestion || question.id !== nextQuestion.id || question.text !== nextQuestion.text;
  });
}
