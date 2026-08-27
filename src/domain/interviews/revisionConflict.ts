export class InterviewRevisionConflictError extends Error {
  readonly code = 'INTERVIEW_REVISION_CONFLICT';

  constructor(message = '다른 운영진이 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 시도해주세요.') {
    super(message);
    this.name = 'InterviewRevisionConflictError';
  }
}

export function assertExpectedRevision(current: number, expected: number | undefined, label: string) {
  if (expected != null && current !== expected) {
    throw new InterviewRevisionConflictError(`${label}이(가) 다른 운영진에 의해 변경되었습니다. 최신 내용을 확인한 뒤 다시 시도해주세요.`);
  }
}

export function timestampMillis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

export function assertExpectedUpdatedAt(current: unknown, expectedMillis: number | undefined, label: string) {
  if (expectedMillis != null && timestampMillis(current) !== expectedMillis) {
    throw new InterviewRevisionConflictError(`${label}이(가) 다른 운영진에 의해 변경되었습니다. 최신 내용을 확인한 뒤 다시 시도해주세요.`);
  }
}

export function isInterviewRevisionConflict(error: unknown): error is InterviewRevisionConflictError {
  return error instanceof InterviewRevisionConflictError
    || (error instanceof Error && 'code' in error && error.code === 'INTERVIEW_REVISION_CONFLICT');
}
