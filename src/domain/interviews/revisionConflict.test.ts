import { describe, expect, it } from 'vitest';
import {
  InterviewRevisionConflictError,
  assertExpectedRevision,
  assertExpectedUpdatedAt,
  timestampMillis,
} from './revisionConflict';

describe('interview revision conflicts', () => {
  it('기대 리비전과 현재 리비전이 다르면 충돌로 판정한다', () => {
    expect(() => assertExpectedRevision(4, 3, '면접 기록')).toThrow(InterviewRevisionConflictError);
    expect(() => assertExpectedRevision(4, 4, '면접 기록')).not.toThrow();
  });

  it('Firestore Timestamp 형태의 수정 시각도 충돌 검증에 사용한다', () => {
    const updatedAt = { toMillis: () => 1234 };
    expect(timestampMillis(updatedAt)).toBe(1234);
    expect(() => assertExpectedUpdatedAt(updatedAt, 999, '지원자 정보')).toThrow(InterviewRevisionConflictError);
    expect(() => assertExpectedUpdatedAt(updatedAt, 1234, '지원자 정보')).not.toThrow();
  });
});
