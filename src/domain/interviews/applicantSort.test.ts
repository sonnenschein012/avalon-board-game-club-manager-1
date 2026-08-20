import { describe, expect, it } from 'vitest';
import { sortInterviewApplicants } from './applicantSort';

const applicant = (name: string, number: string, fields: Array<{ header: string; value: string }> = []) => ({ name, applicantNumber: number, applicationData: fields });

describe('applicant sorting', () => {
  it('sorts student numbers naturally rather than lexicographically', () => {
    const result = sortInterviewApplicants([
      applicant('A', '10'), applicant('B', '2'), applicant('C', '1'),
    ], 'applicantNumber', 'asc');
    expect(result.map(item => item.applicantNumber)).toEqual(['1', '2', '10']);
  });

  it('sorts a selected application field and places missing values last', () => {
    const result = sortInterviewApplicants([
      applicant('없음', '3'),
      applicant('후배', '2', [{ header: '학번', value: '20250002' }]),
      applicant('선배', '1', [{ header: '학번', value: '20240010' }]),
    ], 'application:학번', 'asc');
    expect(result.map(item => item.name)).toEqual(['선배', '후배', '없음']);
  });

  it('sorts Firestore timestamp fields in the selected direction', () => {
    const at = (millis: number) => ({ toMillis: () => millis });
    const result = sortInterviewApplicants([
      { ...applicant('먼저 등록', '1'), createdAt: at(100) },
      { ...applicant('나중 등록', '2'), createdAt: at(200) },
      applicant('시각 없음', '3'),
    ], 'createdAt', 'desc');
    expect(result.map(item => item.name)).toEqual(['나중 등록', '먼저 등록', '시각 없음']);
  });
});
