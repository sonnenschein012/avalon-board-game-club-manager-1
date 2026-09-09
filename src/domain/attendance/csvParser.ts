import type { Member } from '../../types';
import { isSameName } from '../matching/isSameName';

export const attendanceFields = {
  name: '이름 또는 학번 및 이름', studentIdPrefix: '학번', drink: '음료',
  afterparty: '뒤풀이 참석 여부', request: '희망사항',
} as const;
export type AttendanceField = keyof typeof attendanceFields;
// -1 needs a choice; -2 explicitly omits an optional field.
export type AttendanceMapping = Record<AttendanceField, number>;
export interface AttendanceImportInput {
  headers: string[];
  rows: string[][];
  mapping: AttendanceMapping;
}
export interface AttendanceImportRow {
  name: string;
  studentIdPrefix: string;
  drink: string;
  afterparty?: boolean;
  request: string;
}
export interface AttendancePreviewRow {
  sourceRowNumber: number;
  data: AttendanceImportRow;
  rawAfterparty: string;
  memberId?: string;
  errors: string[];
  warnings: string[];
}

const aliases: Record<AttendanceField, readonly string[]> = {
  name: ['학번 및 이름', '학번 이름', '이름', '성명', 'name'],
  studentIdPrefix: ['학번', '입학년도', 'student id'],
  drink: ['주문할 음료', '마시고 싶은 음료', '음료'],
  afterparty: ['뒤풀이에 참석하시나요?', '뒤풀이 여부', '뒤풀이 참석 여부', '뒤풀이'],
  request: ['희망사항', '행사 관련 희망사항', '요청사항'],
};
const cleanHeader = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(/[\s\u200B-\u200D\uFEFF?？]/g, '').replace(/뒷풀이/g, '뒤풀이');

export function detectAttendanceMapping(headers: readonly string[]): AttendanceMapping {
  return Object.fromEntries((Object.keys(attendanceFields) as AttendanceField[]).map(field => {
    const matches = headers.flatMap((header, index) => aliases[field].some(alias => cleanHeader(alias) === cleanHeader(header)) ? [index] : []);
    return [field, matches.length === 1 ? matches[0]! : matches.length === 0 && (field === 'request' || field === 'studentIdPrefix') ? -2 : -1];
  })) as AttendanceMapping;
}

export function attendanceMappingErrors(headers: readonly string[], mapping: AttendanceMapping): string[] {
  const errors: string[] = [];
  const used = new Set<number>();
  for (const field of Object.keys(attendanceFields) as AttendanceField[]) {
    const index = mapping[field];
    if (index === -2 && field !== 'name') continue;
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) {
      errors.push(`${attendanceFields[field]} 열을 연결해주세요${field === 'name' ? '.' : '. 해당 질문이 없으면 사용 안 함을 선택하세요.'}`);
    } else if (used.has(index)) {
      errors.push('서로 다른 항목을 같은 파일 열에 연결할 수 없습니다.');
    } else used.add(index);
  }
  return errors;
}

export function parseAfterparty(value: string): boolean | undefined {
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[.!！。\s]/g, '');
  if (['네', '넵', '예', '참석', '참석함', '참석합니다', '필참', 'o', 'y', 'yes', 'true'].includes(normalized)) return true;
  if (['아니오', '아니요', '불참', '불참합니다', '미참석', '참석안함', '참석하지않습니다', 'x', 'n', 'no', 'false'].includes(normalized)) return false;
  return undefined;
}

const prefixOf = (value: string) => value.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(Boolean) || '';

export function previewAttendanceCsv(input: AttendanceImportInput, members: readonly Member[] = []) {
  const { headers, rows, mapping } = input;
  const mappingErrors = attendanceMappingErrors(headers, mapping);
  const previewRows: AttendancePreviewRow[] = mappingErrors.length ? [] : rows.flatMap((values, index) => {
    if (values.every(value => !value.trim())) return [];
    const get = (field: AttendanceField) => (values[mapping[field]] ?? '').trim();
    const rawName = get('name').normalize('NFKC');
    const combined = rawName.match(/^(\d{2}|20\d{2}\d*)\s*(?=[^\d\s])(.+)$/);
    const name = (combined?.[2] ?? rawName).trim();
    const rawStudentId = get('studentIdPrefix');
    const studentIdPrefix = prefixOf(rawStudentId || combined?.[1] || '');
    const rawAfterparty = get('afterparty');
    const afterparty = parseAfterparty(rawAfterparty);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!name || /^\d+$/.test(name)) errors.push('이름을 확인해주세요.');
    if (rawStudentId && !/^\d{2}(?:학번)?$|^20\d{2,}$/.test(rawStudentId)) errors.push('학번은 두 자리 입학년도 또는 전체 학번으로 입력해주세요.');
    if (rawStudentId && combined && prefixOf(combined[1]!) !== studentIdPrefix) errors.push('이름에 포함된 학번과 학번 열이 다릅니다.');
    if (rawAfterparty && afterparty === undefined) errors.push(`뒤풀이 응답 “${rawAfterparty}”을 해석할 수 없습니다.`);
    if (values.length !== headers.length) errors.push('행의 열 개수가 헤더와 다릅니다.');
    const namesakes = members.filter(member => isSameName(member.name, name));
    const matches = namesakes.filter(member => !studentIdPrefix || prefixOf(member.studentId) === studentIdPrefix);
    if (matches.length > 1 || (namesakes.length && !matches.length)) errors.push('동명이인 또는 학번 불일치가 있습니다. 이름과 학번을 확인해주세요.');
    else if (!matches.length) warnings.push('미등록 부원 · 가져온 뒤 멤버 추가 가능');
    if (mapping.drink >= 0 && !get('drink')) warnings.push('음료 미응답');
    if (mapping.afterparty >= 0 && !rawAfterparty) warnings.push('뒤풀이 미응답');
    return [{
      sourceRowNumber: index + 2,
      data: { name, studentIdPrefix, drink: get('drink'), request: get('request'), ...(afterparty === undefined ? {} : { afterparty }) },
      rawAfterparty, ...(matches.length === 1 ? { memberId: matches[0]!.id } : {}), errors, warnings,
    }];
  });
  const keys = new Map<string, AttendancePreviewRow[]>();
  for (const row of previewRows) {
    const key = row.memberId || `${row.data.studentIdPrefix}:${row.data.name.replace(/\s/g, '').toLowerCase()}`;
    keys.set(key, [...(keys.get(key) ?? []), row]);
  }
  for (const duplicates of keys.values()) if (duplicates.length > 1) {
    for (const row of duplicates) row.errors.push(`같은 부원이 중복되었습니다 (${duplicates.map(item => item.sourceRowNumber).join(', ')}행).`);
  }
  return {
    rows: previewRows, mappingErrors,
    canImport: !mappingErrors.length && previewRows.length > 0 && previewRows.every(row => !row.errors.length),
    counts: {
      total: previewRows.length, errors: previewRows.filter(row => row.errors.length).length,
      unregistered: previewRows.filter(row => !row.memberId).length,
      drinks: previewRows.filter(row => row.data.drink).length,
      attending: previewRows.filter(row => row.data.afterparty === true).length,
      absent: previewRows.filter(row => row.data.afterparty === false).length,
      unanswered: previewRows.filter(row => row.data.afterparty === undefined).length,
    },
  };
}
