import { describe, expect, it } from 'vitest';
import { normalizeApplicantNumber, previewApplicantMerge } from './applicantMerge';

const fields = (value: string) => [{ header: '지원동기', value }];

describe('applicant incremental merge', () => {
  it('classifies create, update and unchanged while preserving the existing token', () => {
    const existing = [{ id: 'a1', applicantNumber: ' a-001 ', name: '김지원', phone: '010-1111-2222', applicationData: fields('기존'), accessToken: 'keep-token' }];
    const preview = previewApplicantMerge(existing, [
      { sourceRowNumber: 2, applicantNumber: 'A-001', name: '김지원', phone: '01011112222', applicationData: fields('기존') },
      { sourceRowNumber: 3, applicantNumber: 'A-002', name: '이신규', phone: '01022223333', applicationData: fields('신규') },
    ]);
    expect(preview.counts).toEqual({ create: 1, update: 0, unchanged: 1, review: 0 });
    expect(preview.items[0]?.existing?.accessToken).toBe('keep-token');
  });

  it('detects changed fields and refuses ambiguous duplicates', () => {
    const existing = [{ id: 'a1', applicantNumber: '001', name: '기존', phone: '01000000000', applicationData: [], accessToken: 'token' }];
    const preview = previewApplicantMerge(existing, [
      { sourceRowNumber: 2, applicantNumber: '001', name: '변경', phone: '01000000000', applicationData: [] },
      { sourceRowNumber: 3, applicantNumber: '002', name: '중복1', phone: '1', applicationData: [] },
      { sourceRowNumber: 4, applicantNumber: '002', name: '중복2', phone: '2', applicationData: [] },
    ]);
    expect(preview.items[0]).toMatchObject({ action: 'update', changedFields: ['name'] });
    expect(preview.counts.review).toBe(2);
    expect(normalizeApplicantNumber(' ａｂ-01 ')).toBe('AB-01');
  });
});
