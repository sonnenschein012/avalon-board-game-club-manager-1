import { describe, expect, it } from 'vitest';
import { previewApplicantCsv } from './applicantCsv';

describe('previewApplicantCsv', () => {
  it('maps selected columns by index, preserves leading zeroes, and retains every ordered original field', () => {
    const preview = previewApplicantCsv(
      ['Submitted at', 'Name', 'Phone', 'Applicant number', 'Motivation', 'Motivation'],
      [[
        '2026-08-01 10:00',
        '  Kim Applicant  ',
        '010-0012-0034',
        '0007',
        'First answer',
        'Second answer',
      ]],
      { applicantNumber: 3, name: 1, phone: 2 },
    );

    expect(preview.validRowCount).toBe(1);
    expect(preview.stagedRows[0]).toEqual({
      sourceRowNumber: 2,
      applicantNumber: '0007',
      name: 'Kim Applicant',
      phone: '010-0012-0034',
      applicationData: [
        { header: 'Submitted at', value: '2026-08-01 10:00' },
        { header: 'Name', value: '  Kim Applicant  ' },
        { header: 'Phone', value: '010-0012-0034' },
        { header: 'Applicant number', value: '0007' },
        { header: 'Motivation', value: 'First answer' },
        { header: 'Motivation', value: 'Second answer' },
      ],
    });
  });

  it('reports every missing required field on its original CSV row', () => {
    const preview = previewApplicantCsv(
      ['Number', 'Name', 'Phone', 'Note'],
      [
        ['1', '', '', 'has other data'],
        ['', 'Park Applicant', '010-0000-0000', ''],
      ],
      { applicantNumber: 0, name: 1, phone: 2 },
    );

    expect(preview.stagedRows).toEqual([]);
    expect(preview.invalidRowCount).toBe(2);
    expect(preview.errors.map(({ sourceRowNumber, error }) => ({
      sourceRowNumber,
      code: error.code,
      field: error.field,
    }))).toEqual([
      { sourceRowNumber: 2, code: 'missing', field: 'name' },
      { sourceRowNumber: 2, code: 'missing', field: 'phone' },
      { sourceRowNumber: 3, code: 'missing', field: 'applicantNumber' },
    ]);
  });

  it('marks every row in a duplicate applicant-number group invalid', () => {
    const preview = previewApplicantCsv(
      ['Number', 'Name', 'Phone'],
      [
        ['0042', 'Kim Applicant', '010-1111-1111'],
        ['0043', 'Lee Applicant', '010-2222-2222'],
        [' 0042 ', 'Park Applicant', '010-3333-3333'],
      ],
      { applicantNumber: 0, name: 1, phone: 2 },
    );

    expect(preview.stagedRows.map((row) => row.applicantNumber)).toEqual(['0043']);
    expect(preview.rows[0]?.errors[0]).toMatchObject({
      code: 'duplicate',
      field: 'applicantNumber',
      duplicateRowNumbers: [4],
    });
    expect(preview.rows[2]?.errors[0]).toMatchObject({
      code: 'duplicate',
      field: 'applicantNumber',
      duplicateRowNumbers: [2],
    });
  });

  it('ignores completely blank trailing rows but preserves extra row values', () => {
    const preview = previewApplicantCsv(
      ['Number', 'Name', 'Phone'],
      [
        ['7', 'Choi Applicant', '010-4444-4444', 'extra answer'],
        ['', '', ''],
      ],
      { applicantNumber: 0, name: 1, phone: 2 },
    );

    expect(preview.totalRows).toBe(1);
    expect(preview.stagedRows[0]?.applicationData).toEqual([
      { header: 'Number', value: '7' },
      { header: 'Name', value: 'Choi Applicant' },
      { header: 'Phone', value: '010-4444-4444' },
      { header: '', value: 'extra answer' },
    ]);
  });

  it('rejects missing or overlapping column mappings', () => {
    expect(() => previewApplicantCsv(
      ['Number', 'Name'],
      [['1', 'Kim Applicant']],
      { applicantNumber: 0, name: 1, phone: 2 },
    )).toThrow(RangeError);
    expect(() => previewApplicantCsv(
      ['Number', 'Name', 'Phone'],
      [['1', 'Kim Applicant', '010-0000-0000']],
      { applicantNumber: 0, name: 1, phone: 1 },
    )).toThrow(RangeError);
  });
});
