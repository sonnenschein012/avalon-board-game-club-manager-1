import type { InterviewApplicationField } from '../../types';

export type ApplicantSortKey =
  | 'name'
  | 'applicantNumber'
  | 'createdAt'
  | 'updatedAt'
  | 'responseUpdatedAt'
  | 'assignmentStartsAt'
  | `application:${string}`;

export interface SortableApplicant {
  name: string;
  applicantNumber: string;
  applicationData: InterviewApplicationField[];
  createdAt?: { toMillis(): number } | null;
  updatedAt?: { toMillis(): number } | null;
  access?: { responseUpdatedAt?: { toMillis(): number } | null; updatedAt?: { toMillis(): number } | null } | null;
  assignment?: { startsAt: { toMillis(): number } } | null;
}

function valueFor(applicant: SortableApplicant, key: ApplicantSortKey): string | number | null {
  if (key === 'name') return applicant.name;
  if (key === 'applicantNumber') return applicant.applicantNumber;
  if (key === 'createdAt') return applicant.createdAt?.toMillis() ?? null;
  if (key === 'updatedAt') return applicant.updatedAt?.toMillis() ?? null;
  if (key === 'responseUpdatedAt') return (applicant.access?.responseUpdatedAt ?? applicant.access?.updatedAt)?.toMillis() ?? null;
  if (key === 'assignmentStartsAt') return applicant.assignment?.startsAt.toMillis() ?? null;
  const header = key.slice('application:'.length);
  return applicant.applicationData.find(field => field.header === header)?.value.trim() ?? null;
}

function comparable(value: string | number | null): string | number | null {
  if (value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const normalized = value.normalize('NFKC').trim();
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T].*)?$/.test(normalized)) {
    const parsed = Date.parse(normalized.replace(/\./g, '-'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return normalized;
}

export function sortInterviewApplicants<T extends SortableApplicant>(
  applicants: readonly T[],
  key: ApplicantSortKey,
  direction: 'asc' | 'desc',
): T[] {
  const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });
  const sign = direction === 'asc' ? 1 : -1;
  return [...applicants].sort((left, right) => {
    const leftValue = comparable(valueFor(left, key));
    const rightValue = comparable(valueFor(right, key));
    if (leftValue === null && rightValue === null) return collator.compare(left.name, right.name);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    const compared = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : collator.compare(String(leftValue), String(rightValue));
    return compared === 0 ? collator.compare(left.name, right.name) : compared * sign;
  });
}
