import { describe, expect, it } from 'vitest';
import { parseMemberCsv } from './memberCsv';

describe('parseMemberCsv', () => {
  it('retains supplied student IDs and phones while trimming fields and filtering known genres', () => {
    const result = parseMemberCsv([{
      이름: ' 김회원 ', 학번: ' 20260001 ', 연락처: ' 01012345678 ', 성별: '여',
      선호장르: '카드, 없는장르, 추리', 닉네임: ' 별명 ', 메모: ' 메모 ',
    }], [], '2026-2');

    expect(result.members).toEqual([{
      name: '김회원', studentId: '20260001', phone: '01012345678', gender: '여',
      preferredGenre: ['카드', '추리'], nickname: '별명', memo: '메모', semester: '2026-2',
      status: '활동', dormantSemester: '', isBoardMember: false,
    }]);
  });

  it('uses roster defaults and preserves the legacy spreadsheet semester substitutions', () => {
    const result = parseMemberCsv([
      { 이름: '첫회원', 학번: '01', 가입학기: '2026-Jan' },
      { 이름: '둘회원', 학번: '02', 가입학기: '2026-FEB', 성별: '기타' },
      { 이름: '셋회원', 학번: '03', 성별: '알 수 없음' },
    ], [], '2027-1');

    expect(result.members.map(member => [member.semester, member.gender, member.nickname])).toEqual([
      ['2026-1', '남', '01 첫회원'], ['2026-2', '기타', '02 둘회원'], ['2027-1', '남', '03 셋회원'],
    ]);
    expect(result.members[0]).toMatchObject({ phone: '', preferredGenre: [], memo: '', isBoardMember: false });
  });

  it('keeps the first exact name/student-ID pair and ignores rows missing either field', () => {
    const result = parseMemberCsv([
      { 이름: '기존', 학번: '26', 닉네임: '다른 별명' },
      { 이름: ' 신규 ', 학번: '26', 닉네임: '첫 별명' },
      { 이름: '신규', 학번: ' 26 ', 닉네임: '두 번째 별명' },
      { 이름: '신규', 학번: '2026' },
      { 이름: '', 학번: '26' },
      { 이름: '누락', 학번: '' },
    ], [{ name: '기존', studentId: '26' }], '2026-2');

    expect(result.members.map(member => [member.name, member.studentId, member.nickname])).toEqual([
      ['신규', '26', '첫 별명'], ['신규', '2026', '2026 신규'],
    ]);
    expect(result.skippedCount).toBe(2);
  });

  it('derives dormancy from status or dormant semester and accepts the existing board-member markers', () => {
    const result = parseMemberCsv([
      { 이름: '첫회원', 학번: '01', 상태: '휴면', 임원여부: ' Y ' },
      { 이름: '둘회원', 학번: '02', 상태: '활동', 휴면학기: ' 2027-1 ', 임원여부: '임원' },
      { 이름: '셋회원', 학번: '03', 임원여부: 'TRUE' },
      { 이름: '넷회원', 학번: '04', 임원여부: 'yes' },
    ], [], '2026-2');

    expect(result.members.map(member => [member.status, member.dormantSemester, member.isBoardMember])).toEqual([
      ['휴면', '', true], ['휴면', '2027-1', true], ['활동', '', true], ['활동', '', false],
    ]);
  });
});
