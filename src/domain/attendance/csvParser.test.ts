import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { detectAttendanceMapping, previewAttendanceCsv, parseAfterparty, type AttendanceImportInput } from './csvParser';
import type { Member } from '../../types';

const headers = ['타임스탬프', '학번 및 이름', '주문할 음료', '개강총회에 참석하시나요?', '뒤풀이에 참석하시나요?', '희망사항'];
const input = (rows: string[][], titles = headers): AttendanceImportInput => ({ headers: titles, rows, mapping: detectAttendanceMapping(titles) });

describe('attendance CSV review', () => {
  it('reads the six-question survey and keeps blank requests empty', () => {
    const result = previewAttendanceCsv(input([
      ['date', '23 김테스트', '복숭아 아이스티', '네', '아니오', ''],
      ['date', '26 이테스트', '캐모마일', '아니요', '네', '전략 게임'],
    ]));
    expect(result.canImport).toBe(true);
    expect(result.counts).toMatchObject({ total: 2, drinks: 2, attending: 1, absent: 1, errors: 0 });
    expect(result.rows[0]?.data).toEqual({ name: '김테스트', studentIdPrefix: '23', drink: '복숭아 아이스티', afterparty: false, request: '' });
  });
  it('supports old wording, BOM, spaces, question marks and reordered columns', () => {
    const result = previewAttendanceCsv(input([[' O ', '차', '24김테스트']], [' 뒷풀이에  참석하시나요？ ', '마시고 싶은 음료', '\uFEFF학번 및 이름']));
    expect(result.canImport).toBe(true);
    expect(result.rows[0]?.data).toMatchObject({ name: '김테스트', studentIdPrefix: '24', drink: '차', afterparty: true });
  });
  it('requires explicit mapping for new or ambiguous questions and allows optional omission', () => {
    const draft = input([['김테스트', '라떼', '아니오']], ['성함을 적어주세요', '원하는 메뉴', '파티 참석']);
    expect(previewAttendanceCsv(draft).canImport).toBe(false);
    draft.mapping = { name: 0, studentIdPrefix: -2, drink: 1, afterparty: 2, request: -2 };
    expect(previewAttendanceCsv(draft).canImport).toBe(true);
    expect(detectAttendanceMapping(['이름', '음료', '음료']).drink).toBe(-1);
    draft.mapping.afterparty = -2;
    expect(previewAttendanceCsv(draft).rows[0]?.data).not.toHaveProperty('afterparty');
    draft.mapping.name = -2;
    expect(previewAttendanceCsv(draft).canImport).toBe(false);
  });
  it('rejects overlapping, out-of-range mappings, empty files and malformed records', () => {
    const draft = input([['date', '김테스트']]);
    expect(previewAttendanceCsv(draft).rows[0]?.errors).toContain('행의 열 개수가 헤더와 다릅니다.');
    draft.mapping.drink = draft.mapping.name;
    expect(previewAttendanceCsv(draft).canImport).toBe(false);
    draft.mapping.drink = 900;
    expect(previewAttendanceCsv(draft).canImport).toBe(false);
    expect(previewAttendanceCsv(input([])).canImport).toBe(false);
    expect(previewAttendanceCsv(input([['', '', '', '', '', '']])).counts.total).toBe(0);
  });
  it.each(['불참', '미참석', '참석 안함', 'no', '아니요', 'X'])('does not turn negative response %s into attendance', value => {
    expect(parseAfterparty(value)).toBe(false);
  });
  it('distinguishes a blank response from absence and blocks unknown nonblank answers', () => {
    const result = previewAttendanceCsv(input([
      ['date', '23 김테스트', '', '', '', ''],
      ['date', '24 이테스트', '', '', '아마도', ''],
    ]));
    expect(result.rows[0]?.data).not.toHaveProperty('afterparty');
    expect(result.rows[0]?.warnings).toContain('뒤풀이 미응답');
    expect(result.rows[1]?.errors).toContain('뒤풀이 응답 “아마도”을 해석할 수 없습니다.');
    expect(result.canImport).toBe(false);
  });
  it('supports split and combined full student IDs, and detects conflicts', () => {
    const draft = input([['20231111 김테스트', '20231111', '차', '네']], ['이름', '학번', '음료', '뒤풀이']);
    expect(previewAttendanceCsv(draft).rows[0]?.data).toMatchObject({ name: '김테스트', studentIdPrefix: '23' });
    draft.rows[0]![1] = '24';
    expect(previewAttendanceCsv(draft).canImport).toBe(false);
  });
  it('reports duplicates on original rows, including blank lines between them', () => {
    const draft = input([['23 김테스트'], [''], ['23김 테스트']], ['이름']);
    draft.mapping.drink = -2; draft.mapping.afterparty = -2;
    const result = previewAttendanceCsv(draft);
    expect(result.rows.map(row => row.sourceRowNumber)).toEqual([2, 4]);
    expect(result.counts.errors).toBe(2);
    expect(result.rows[0]?.errors.join('')).toContain('2, 4행');
  });
  it('warns for new members, but blocks ambiguous or conflicting existing identities', () => {
    const members = [{ id: 'm1', name: '김테스트', studentId: '20230001' }, { id: 'm2', name: '김테스트', studentId: '20240002' }] as Member[];
    const draft = input([['김테스트', '차', '네']], ['이름', '음료', '뒤풀이']);
    expect(previewAttendanceCsv(draft, members).canImport).toBe(false);
    draft.rows[0]![0] = '23 김테스트';
    expect(previewAttendanceCsv(draft, members).rows[0]?.memberId).toBe('m1');
    draft.rows[0]![0] = '25 김테스트';
    expect(previewAttendanceCsv(draft, members).canImport).toBe(false);
    draft.rows[0]![0] = '26 신입테스트';
    const result = previewAttendanceCsv(draft, members);
    expect(result.canImport).toBe(true);
    expect(result.counts.unregistered).toBe(1);
  });
  it('keeps quoted commas and multiline requests when parsing CSV', () => {
    const matrix = Papa.parse<string[]>('이름,음료,뒤풀이,희망사항\r\n23 김테스트,"차, 따뜻하게",네,"전략 게임\n하고 싶어요"\r\n').data;
    const result = previewAttendanceCsv(input(matrix.slice(1), matrix[0]!));
    expect(result.canImport).toBe(true);
    expect(result.rows[0]?.data.request).toBe('전략 게임\n하고 싶어요');
    expect(result.rows[0]?.data.drink).toBe('차, 따뜻하게');
  });
});
