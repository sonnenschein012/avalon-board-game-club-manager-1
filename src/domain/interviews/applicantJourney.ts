import type { InterviewAccess, InterviewApplicant } from '../../types';
import { getInterviewProgressStatus, isAssignmentConfirmationCurrent } from './interviewV3Policy';

export const APPLICANT_JOURNEY_STATIONS = [
  { id: 'notice', label: '안내', fullLabel: '조사 안내' },
  { id: 'response', label: '응답', fullLabel: '가능시간 응답' },
  { id: 'assignment', label: '배정', fullLabel: '면접시간 배정' },
  { id: 'confirmation', label: '확정', fullLabel: '확정 안내' },
  { id: 'interview', label: '면접', fullLabel: '면접 진행' },
] as const;

export type ApplicantJourneyBadgeTone = 'warning' | 'danger' | 'muted' | 'success';

export interface ApplicantJourneyModel {
  currentIndex: number;
  completeAll: boolean;
  detail: string;
  badges: Array<{ label: string; tone: ApplicantJourneyBadgeTone }>;
}

type JourneyApplicant = Pick<
  InterviewApplicant,
  'lifecycle' | 'applicationStatus' | 'availabilityMessage' | 'confirmationMessage' | 'assignment' | 'assignmentRevision' | 'interviewStatus' | 'selectionStatus'
> & { access?: Pick<InterviewAccess, 'submittedAt'> | null };

export function getApplicantJourney(applicant: JourneyApplicant, assignmentDetail = ''): ApplicantJourneyModel {
  const withdrawn = (applicant.applicationStatus ?? 'active') === 'withdrawn';
  const archived = (applicant.lifecycle ?? 'active') === 'archived';
  const submitted = Boolean(applicant.access?.submittedAt);
  const hasNotice = Boolean(applicant.availabilityMessage?.firstMarkedSentAt);
  const hasAssignment = Boolean(applicant.assignment);
  const confirmationCurrent = isAssignmentConfirmationCurrent(applicant);
  const confirmationPreviouslySent = Boolean(applicant.confirmationMessage?.firstMarkedSentAt);
  const progressStatus = getInterviewProgressStatus(applicant);
  const completed = progressStatus === 'completed';
  const actionNeeded = progressStatus === 'action_needed';
  const badges: ApplicantJourneyModel['badges'] = [];

  if (withdrawn) badges.push({ label: '지원 철회', tone: 'danger' });
  if (archived) badges.push({ label: '보관', tone: 'muted' });
  if (actionNeeded) badges.push({ label: '조치 필요', tone: 'danger' });
  if (hasAssignment && confirmationPreviouslySent && !confirmationCurrent) badges.push({ label: '확정 재발송 필요', tone: 'warning' });
  if (submitted && !hasNotice) badges.push({ label: '안내 기록 없음', tone: 'warning' });
  if (hasAssignment && !submitted) badges.push({ label: '응답 기록 없음', tone: 'warning' });
  if (applicant.selectionStatus === 'selected') badges.push({ label: '선발', tone: 'success' });
  if (applicant.selectionStatus === 'rejected') badges.push({ label: '미선발', tone: 'muted' });

  if (completed) return { currentIndex: 4, completeAll: true, detail: '면접 완료', badges };
  if (confirmationCurrent) return { currentIndex: 4, completeAll: false, detail: assignmentDetail || '면접 예정', badges };
  if (hasAssignment) return { currentIndex: 3, completeAll: false, detail: '확정 안내 미발송', badges };
  if (submitted) return { currentIndex: 2, completeAll: false, detail: '면접시간 배정 대기', badges };
  if (hasNotice) return { currentIndex: 1, completeAll: false, detail: '가능시간 응답 대기', badges };
  return { currentIndex: 0, completeAll: false, detail: '조사 안내 미발송', badges };
}
