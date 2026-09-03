import type { InterviewOverallRating } from '../../types';

export const OVERALL_RATINGS: readonly InterviewOverallRating[] = [
  'strongly_recommend',
  'recommend',
  'neutral',
  'not_recommend',
  'strongly_not_recommend',
];

export const INTERVIEW_RATING_LABELS: Record<InterviewOverallRating, string> = {
  strongly_recommend: '적극 추천',
  recommend: '추천',
  neutral: '중립',
  not_recommend: '비추천',
  strongly_not_recommend: '적극 비추천',
};
