import type { InterviewApplicationField } from '../../types';

export interface ApplicantCsvColumnMapping {
  applicantNumber: number;
  name: number;
  phone: number;
}

export type ApplicantCsvField = keyof ApplicantCsvColumnMapping;
export type ApplicantCsvRowErrorCode = 'missing' | 'duplicate';

export interface ApplicantCsvRowError {
  code: ApplicantCsvRowErrorCode;
  field: ApplicantCsvField;
  message: string;
  duplicateRowNumbers: number[];
}

export interface StagedApplicantCsvRow {
  sourceRowNumber: number;
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
}

export interface ApplicantCsvPreviewRow extends StagedApplicantCsvRow {
  valid: boolean;
  errors: ApplicantCsvRowError[];
}

export interface ApplicantCsvPreview {
  rows: ApplicantCsvPreviewRow[];
  stagedRows: StagedApplicantCsvRow[];
  errors: Array<{ sourceRowNumber: number; error: ApplicantCsvRowError }>;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
}

interface ParsedRow {
  sourceRowNumber: number;
  values: readonly string[];
  applicantNumber: string;
  name: string;
  phone: string;
  applicationData: InterviewApplicationField[];
}

function assertValidMapping(headers: readonly string[], mapping: ApplicantCsvColumnMapping): void {
  const indexes = [mapping.applicantNumber, mapping.name, mapping.phone];
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= headers.length)) {
    throw new RangeError('Every mapped column index must point to an existing CSV header.');
  }
  if (new Set(indexes).size !== indexes.length) {
    throw new RangeError('Applicant number, name, and phone must use different CSV columns.');
  }
}

function valueAt(values: readonly string[], index: number): string {
  return values[index] ?? '';
}

function isBlankRow(values: readonly string[]): boolean {
  return values.every((value) => value.trim() === '');
}

function preserveApplicationData(headers: readonly string[], values: readonly string[]): InterviewApplicationField[] {
  const fieldCount = Math.max(headers.length, values.length);
  return Array.from({ length: fieldCount }, (_, index) => ({
    header: headers[index] ?? '',
    value: values[index] ?? '',
  }));
}

function missingError(field: ApplicantCsvField): ApplicantCsvRowError {
  return {
    code: 'missing',
    field,
    message: `${field} is required.`,
    duplicateRowNumbers: [],
  };
}

function duplicateError(otherRows: number[]): ApplicantCsvRowError {
  return {
    code: 'duplicate',
    field: 'applicantNumber',
    message: 'applicantNumber must be unique within the import.',
    duplicateRowNumbers: otherRows,
  };
}

/**
 * Builds a validation preview without coercing CSV values to numbers. Completely
 * blank rows (including a parser's trailing blank row) are ignored.
 */
export function previewApplicantCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  mapping: Readonly<ApplicantCsvColumnMapping>,
): ApplicantCsvPreview {
  assertValidMapping(headers, mapping);

  const parsedRows: ParsedRow[] = rows.flatMap<ParsedRow>((values, index) => {
    if (isBlankRow(values)) return [];

    return [{
      sourceRowNumber: index + 2,
      values,
      applicantNumber: valueAt(values, mapping.applicantNumber).trim(),
      name: valueAt(values, mapping.name).trim(),
      phone: valueAt(values, mapping.phone).trim(),
      applicationData: preserveApplicationData(headers, values),
    }];
  });

  const rowsByApplicantNumber = new Map<string, number[]>();
  for (const row of parsedRows) {
    if (row.applicantNumber === '') continue;
    const sourceRows = rowsByApplicantNumber.get(row.applicantNumber) ?? [];
    sourceRows.push(row.sourceRowNumber);
    rowsByApplicantNumber.set(row.applicantNumber, sourceRows);
  }

  const previewRows: ApplicantCsvPreviewRow[] = parsedRows.map((row) => {
    const errors: ApplicantCsvRowError[] = [];
    if (row.applicantNumber === '') errors.push(missingError('applicantNumber'));
    if (row.name === '') errors.push(missingError('name'));
    if (row.phone === '') errors.push(missingError('phone'));

    const duplicateRows = rowsByApplicantNumber.get(row.applicantNumber) ?? [];
    if (row.applicantNumber !== '' && duplicateRows.length > 1) {
      errors.push(duplicateError(duplicateRows.filter((rowNumber) => rowNumber !== row.sourceRowNumber)));
    }

    return {
      sourceRowNumber: row.sourceRowNumber,
      applicantNumber: row.applicantNumber,
      name: row.name,
      phone: row.phone,
      applicationData: row.applicationData,
      valid: errors.length === 0,
      errors,
    };
  });

  const stagedRows: StagedApplicantCsvRow[] = previewRows
    .filter((row) => row.valid)
    .map(({ sourceRowNumber, applicantNumber, name, phone, applicationData }) => ({
      sourceRowNumber,
      applicantNumber,
      name,
      phone,
      applicationData,
    }));
  const errors = previewRows.flatMap((row) => row.errors.map((error) => ({
    sourceRowNumber: row.sourceRowNumber,
    error,
  })));

  return {
    rows: previewRows,
    stagedRows,
    errors,
    totalRows: previewRows.length,
    validRowCount: stagedRows.length,
    invalidRowCount: previewRows.length - stagedRows.length,
  };
}
