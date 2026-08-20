import { describe, expect, it } from 'vitest';
import { buildInterviewCsvRows } from './interviewCsvExport';
import type { InterviewApplicantWithAccess } from '../../services/interviewsService';
import type { InterviewRound } from '../../types';

const timestamp = (value: string) => ({ toDate: () => new Date(value) });

const round = {
  id: 'round-1',
  name: '2026-2 면접',
  scheduleRevision: 3,
  interviewQuestions: [{ id: 'q1', text: '지원 동기는 무엇인가요?' }],
} as InterviewRound;

const applicant = {
  id: 'applicant-1',
  applicantNumber: '001',
  name: '김아발론',
  phone: '010-0000-0000',
  source: 'csv',
  sourceRowNumber: 2,
  lifecycle: 'active',
  applicationStatus: 'active',
  applicationData: [{ header: '학번', value: '20260001' }, { header: '지원동기', value: '보드게임' }],
  availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
  confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
  assignment: null,
  archivedAt: null,
  archivedReason: null,
  access: { active: true, availability: ['2026-08-25|18:00'], submittedAt: timestamp('2026-08-20T00:00:00Z') },
  link: 'https://example.test/interview/secret-token',
} as unknown as InterviewApplicantWithAccess;

describe('buildInterviewCsvRows', () => {
  it('keeps one row per applicant while preserving variable history in JSON columns', () => {
    const [row] = buildInterviewCsvRows({
      round,
      applicants: [applicant],
      notes: [{ applicantId: applicant.id, answers: { q1: '대답' }, generalNotes: '종합 기록' } as never],
      assignmentEvents: [{ applicantId: applicant.id, type: 'assigned', createdAt: timestamp('2026-08-21T00:00:00Z') } as never],
      recordEvents: [{ applicantId: applicant.id, type: 'completed', createdAt: timestamp('2026-08-22T00:00:00Z') } as never],
      changeRequests: [{ applicantId: applicant.id, status: 'resolved', requestedAt: timestamp('2026-08-23T00:00:00Z') } as never],
      exportedAt: new Date('2026-08-24T00:00:00Z'),
    });
    if (!row) throw new Error('Expected one exported row.');

    expect(row).toMatchObject({
      '지원번호': '001',
      '지원서_학번': '20260001',
      '지원서_지원동기': '보드게임',
      '현재 가능시간 전체': '2026-08-25 18:00',
      '종합 노트': '종합 기록',
      '면접질문_1. 지원 동기는 무엇인가요?': '대답',
      '배정 이력 건수': '1',
      '면접 기록 이력 건수': '1',
      '일정 변경 요청 건수': '1',
    });
    expect(Object.keys(row).join(',')).not.toContain('secret-token');
  });
});
