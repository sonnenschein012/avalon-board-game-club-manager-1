import type {
  InterviewApplicant,
  InterviewAssignment,
  InterviewAssignmentEvent,
  InterviewChangeRequest,
  InterviewNote,
  InterviewOverallRating,
  InterviewRecordEvent,
  InterviewRound,
} from '../../types';
import type { InterviewApplicantWithAccess } from '../../services/interviewsService';

export interface InterviewCsvExportInput {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  notes: InterviewNote[];
  assignmentEvents: InterviewAssignmentEvent[];
  recordEvents: InterviewRecordEvent[];
  changeRequests: InterviewChangeRequest[];
  exportedAt?: Date;
}

type CsvRow = Record<string, string>;

const RATING_LABELS: Record<InterviewOverallRating, string> = {
  strongly_recommend: '적극 추천',
  recommend: '추천',
  neutral: '중립',
  not_recommend: '비추천',
  strongly_not_recommend: '적극 비추천',
};

const ASSIGNMENT_STATUS_LABELS: Record<NonNullable<InterviewAssignment>['status'], string> = {
  scheduled: '시간 지정 · 안내 전',
  confirmed: '안내 완료',
  change_requested: '일정 변경 요청',
  completed: '완료',
  no_show: '불참',
  cancelled: '취소',
  needs_reschedule: '재조율 필요',
};

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

function formatTimestamp(value: TimestampLike) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const date = value instanceof Date ? value : value.toDate?.();
  return date ? date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';
}

function formatSlot(slot: string | undefined) {
  return slot?.replace('|', ' ') ?? '';
}

function formatRating(value: InterviewOverallRating | null | undefined) {
  return value ? RATING_LABELS[value] : '';
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current instanceof Date) return current.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    if (current && typeof current === 'object' && typeof (current as { toDate?: unknown }).toDate === 'function') {
      return formatTimestamp(current as TimestampLike);
    }
    return current;
  });
}

function assignmentColumns(prefix: string, assignment: InterviewAssignment | null | undefined): CsvRow {
  return {
    [`${prefix}_슬롯`]: formatSlot(assignment?.slotId),
    [`${prefix}_시작 시각`]: formatTimestamp(assignment?.startsAt),
    [`${prefix}_면접 시간(분)`]: assignment ? String(assignment.durationMinutes) : '',
    [`${prefix}_담당 면접관 ID`]: assignment?.interviewerId ?? '',
    [`${prefix}_담당 면접관`]: assignment?.interviewerName ?? '',
    [`${prefix}_배정 상태`]: assignment ? ASSIGNMENT_STATUS_LABELS[assignment.status] : '',
    [`${prefix}_배정 방식`]: assignment?.source === 'automatic' ? '자동' : assignment ? '수동' : '',
    [`${prefix}_잠금 여부`]: assignment ? (assignment.locked ? '잠금' : '미잠금') : '',
    [`${prefix}_확정 안내 리비전`]: assignment?.confirmationRevision == null ? '' : String(assignment.confirmationRevision),
  };
}

function getApplicationColumns(applicants: InterviewApplicant[]) {
  const headers: string[] = [];
  const seen = new Set<string>();
  applicants.forEach(applicant => applicant.applicationData.forEach((field, index) => {
    const header = field.header.trim() || `지원서 문항 ${index + 1}`;
    if (!seen.has(header)) {
      seen.add(header);
      headers.push(header);
    }
  }));
  return headers;
}

function applicationValue(applicant: InterviewApplicant, header: string) {
  return applicant.applicationData.filter((field, index) => (field.header.trim() || `지원서 문항 ${index + 1}`) === header).map(field => field.value).join('\n');
}

function getQuestionColumns(round: InterviewRound, notes: InterviewNote[]) {
  const known = new Map(round.interviewQuestions.map((question, index) => [question.id, `면접질문_${index + 1}. ${question.text}`]));
  notes.forEach(note => Object.keys(note.answers ?? {}).forEach(questionId => {
    if (!known.has(questionId)) known.set(questionId, `면접질문_기록 전용 ${questionId}`);
  }));
  return [...known.entries()];
}

function historyForApplicant<T extends { applicantId: string }>(records: T[], applicantId: string, getOccurredAt: (record: T) => TimestampLike) {
  return records.filter(record => record.applicantId === applicantId)
    .sort((left, right) => formatTimestamp(getOccurredAt(left)).localeCompare(formatTimestamp(getOccurredAt(right)), 'ko-KR'));
}

/**
 * Produces a lossless, one-applicant-per-row export. Variable-length history
 * remains in JSON cells so that no prior assignment or interview snapshot is
 * discarded merely to keep the spreadsheet rectangular.
 */
export function buildInterviewCsvRows(input: InterviewCsvExportInput): CsvRow[] {
  const applicationColumns = getApplicationColumns(input.applicants);
  const questionColumns = getQuestionColumns(input.round, input.notes);
  const notesByApplicant = new Map(input.notes.map(note => [note.applicantId, note]));
  const exportedAt = formatTimestamp(input.exportedAt ?? new Date());

  return input.applicants.map(applicant => {
    const access = applicant.access;
    const note = notesByApplicant.get(applicant.id);
    const assignmentEvents = historyForApplicant(input.assignmentEvents, applicant.id, event => event.createdAt);
    const recordEvents = historyForApplicant(input.recordEvents, applicant.id, event => event.createdAt);
    const changeRequests = historyForApplicant(input.changeRequests, applicant.id, request => request.requestedAt);
    const currentAssignment = applicant.assignment;
    const currentConfirmation = Boolean(currentAssignment && applicant.confirmationMessage?.lastMarkedSentAt)
      && (applicant.confirmationMessage.assignmentRevision ?? 0) === (applicant.assignmentRevision ?? currentAssignment?.confirmationRevision ?? 0);

    return {
      '회차명': input.round.name,
      '회차 ID': input.round.id,
      '회차 일정 리비전': String(input.round.scheduleRevision),
      '내보낸 시각': exportedAt,
      '지원자 내부 ID': applicant.id,
      '지원번호': applicant.applicantNumber,
      '이름': applicant.name,
      '연락처': applicant.phone,
      '등록 방식': applicant.source === 'csv' ? 'CSV' : '개별 추가',
      'CSV 원본 행 번호': applicant.sourceRowNumber == null ? '' : String(applicant.sourceRowNumber),
      '등록 시각': formatTimestamp(applicant.createdAt),
      '마지막 수정 시각': formatTimestamp(applicant.updatedAt),
      '지원 상태': (applicant.applicationStatus ?? 'active') === 'withdrawn' ? '지원 철회' : '정상',
      '지원 철회 시각': formatTimestamp(applicant.withdrawnAt),
      '지원 철회 처리자': applicant.withdrawnBy ?? '',
      '보관 상태': applicant.lifecycle === 'archived' ? '보관' : '정상',
      '보관 시각': formatTimestamp(applicant.archivedAt),
      '보관 사유': applicant.archivedReason ?? '',
      ...Object.fromEntries(applicationColumns.map(header => [`지원서_${header}`, applicationValue(applicant, header)])),
      '개인 페이지 활성 상태': access?.active ? '활성' : access ? '비활성' : '접근 정보 없음',
      '링크 리비전': access?.tokenRevision == null ? '' : String(access.tokenRevision),
      '최초 유효 접속 시각': formatTimestamp(access?.firstAccessedAt),
      '가능시간 응답 상태': access?.submittedAt ? '완료' : '미응답',
      '가능시간 최초 제출 시각': formatTimestamp(access?.submittedAt),
      '가능시간 마지막 수정 시각': formatTimestamp(access?.responseUpdatedAt ?? access?.updatedAt),
      '현재 가능시간 전체': (access?.availability ?? []).map(formatSlot).join('\n'),
      '일정 변경 요청 상태': access?.changeRequestStatus ?? '',
      '일정 변경 요청 건수': String(changeRequests.length),
      '일정 변경 요청 이력': serialize(changeRequests),
      '조사 안내 최초 발송 시각': formatTimestamp(applicant.availabilityMessage?.firstMarkedSentAt),
      '조사 안내 마지막 발송 시각': formatTimestamp(applicant.availabilityMessage?.lastMarkedSentAt),
      '재안내 최초 발송 시각': formatTimestamp(applicant.reminderMessage?.firstMarkedSentAt),
      '재안내 마지막 발송 시각': formatTimestamp(applicant.reminderMessage?.lastMarkedSentAt),
      '확정 안내 최초 발송 시각': formatTimestamp(applicant.confirmationMessage?.firstMarkedSentAt),
      '확정 안내 마지막 발송 시각': formatTimestamp(applicant.confirmationMessage?.lastMarkedSentAt),
      '확정 안내 대상 배정 리비전': applicant.confirmationMessage?.assignmentRevision == null ? '' : String(applicant.confirmationMessage.assignmentRevision),
      '현재 확정 안내 유효 여부': applicant.confirmationMessage?.lastMarkedSentAt ? (currentConfirmation ? '유효' : '재발송 필요') : '미발송',
      '현재 배정 리비전': applicant.assignmentRevision == null ? '' : String(applicant.assignmentRevision),
      '면접 상태': applicant.interviewStatus ?? 'scheduled',
      '조치 필요 사유': applicant.actionNeededReason ?? '',
      ...assignmentColumns('현재 배정', applicant.assignment),
      ...assignmentColumns('직전 배정', applicant.previousAssignment),
      '배정 이력 건수': String(assignmentEvents.length),
      '배정 이력': serialize(assignmentEvents),
      '면접 완료 시각': formatTimestamp(applicant.interviewCompletedAt),
      '면접 완료 처리자': applicant.interviewCompletedBy ?? '',
      '종합평가': formatRating(note?.overallRating ?? applicant.overallRating),
      '종합 노트': note?.generalNotes ?? '',
      '면접 기록 최초 작성 시각': formatTimestamp(note?.createdAt),
      '면접 기록 마지막 수정 시각': formatTimestamp(note?.updatedAt),
      '면접 기록 최종 수정자': note?.updatedBy ?? '',
      ...Object.fromEntries(questionColumns.map(([questionId, header]) => [header, note?.answers?.[questionId] ?? ''])),
      '선발 상태': applicant.selectionStatus ?? 'pending',
      '선발 결정 시각': formatTimestamp(applicant.selectionDecidedAt),
      '선발 결정 처리자': applicant.selectionDecidedBy ?? '',
      '면접 기록 이력 건수': String(recordEvents.length),
      '면접 기록 이력': serialize(recordEvents),
    };
  });
}
