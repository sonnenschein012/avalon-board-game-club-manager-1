import type { InterviewApplicationField } from '../../types';

export interface MergeApplicantRecord {
  id: string;
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
  accessToken: string;
}

export interface MergeApplicantRow {
  sourceRowNumber: number;
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
}

export type ApplicantMergeAction = 'create' | 'update' | 'unchanged' | 'review';

export interface ApplicantMergePreviewItem {
  action: ApplicantMergeAction;
  row: MergeApplicantRow;
  existing: MergeApplicantRecord | null;
  changedFields: Array<'name' | 'phone' | 'applicationData'>;
  reason: string | null;
}

export interface ApplicantMergePreview {
  items: ApplicantMergePreviewItem[];
  counts: Record<ApplicantMergeAction, number>;
}

export function normalizeApplicantNumber(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function fieldsEqual(left: InterviewApplicationField[], right: InterviewApplicationField[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((field, index) => {
    const other = right[index];
    return other?.header === field.header && other.value === field.value;
  });
}

export function previewApplicantMerge(
  existingRecords: readonly MergeApplicantRecord[],
  rows: readonly MergeApplicantRow[],
): ApplicantMergePreview {
  const existingByKey = new Map<string, MergeApplicantRecord[]>();
  existingRecords.forEach(record => {
    const key = normalizeApplicantNumber(record.applicantNumber);
    const records = existingByKey.get(key) ?? [];
    records.push(record);
    existingByKey.set(key, records);
  });
  const incomingCount = new Map<string, number>();
  rows.forEach(row => {
    const key = normalizeApplicantNumber(row.applicantNumber);
    incomingCount.set(key, (incomingCount.get(key) ?? 0) + 1);
  });

  const items = rows.map<ApplicantMergePreviewItem>(row => {
    const key = normalizeApplicantNumber(row.applicantNumber);
    if (!key) return { action: 'review', row, existing: null, changedFields: [], reason: '지원번호가 없습니다.' };
    if ((incomingCount.get(key) ?? 0) > 1) {
      return { action: 'review', row, existing: null, changedFields: [], reason: '업로드 파일 안에 같은 지원번호가 중복되어 있습니다.' };
    }
    const matches = existingByKey.get(key) ?? [];
    if (matches.length > 1) {
      return { action: 'review', row, existing: null, changedFields: [], reason: '기존 데이터에 같은 지원번호가 여러 개 있어 자동 병합할 수 없습니다.' };
    }
    const existing = matches[0] ?? null;
    if (!existing) return { action: 'create', row, existing: null, changedFields: [], reason: null };
    const changedFields: ApplicantMergePreviewItem['changedFields'] = [];
    if (existing.name.trim() !== row.name.trim()) changedFields.push('name');
    if (normalizePhone(existing.phone) !== normalizePhone(row.phone)) changedFields.push('phone');
    if (!fieldsEqual(existing.applicationData, row.applicationData)) changedFields.push('applicationData');
    return {
      action: changedFields.length > 0 ? 'update' : 'unchanged',
      row,
      existing,
      changedFields,
      reason: null,
    };
  });

  return {
    items,
    counts: {
      create: items.filter(item => item.action === 'create').length,
      update: items.filter(item => item.action === 'update').length,
      unchanged: items.filter(item => item.action === 'unchanged').length,
      review: items.filter(item => item.action === 'review').length,
    },
  };
}
