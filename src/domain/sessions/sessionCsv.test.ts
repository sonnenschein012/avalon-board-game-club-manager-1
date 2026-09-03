import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Member } from '../../types';
import { parseSessionCsvRows } from './sessionCsv';

const member = (id: string, name: string, nickname: string): Member => ({
  id, name, nickname, studentId: '20251111', phone: '', gender: '남',
  semester: '2025-1', preferredGenre: [], createdAt: Timestamp.fromMillis(0),
});
const members = [member('m1', '김철수', '철수'), member('m2', '박영희', '영희')];
const games = [{ id: 'g1', title: '스플렌더' }, { id: 'g2', title: 'The Crew' }];

describe('session CSV import', () => {
  it('retains legacy nickname matching without inventing a board-role snapshot', () => {
    const { sessions, missingGames } = parseSessionCsvRows([{
      '날짜': '2026-09-02', '조 이름': 'A', '조원 명단(닉네임)': '철수 👑, 25박영희',
      '플레이한 게임들': '스 플렌더, the\u200bcrew',
    }], ['날짜', '조원 명단(닉네임)'], members, games);

    expect(missingGames).toEqual([]);
    expect(sessions).toEqual([{
      date: '2026-09-02', name: '2026-09-02 정기 모임',
      groups: [{ name: 'A', memberIds: ['m1', 'm2'], gameIds: ['g1', 'g2'], targetSize: 2, notes: '' }],
    }]);
    expect(sessions[0]).not.toHaveProperty('boardMemberIds');
  });

  it('groups current exports by both date and name, preserving marked and empty role snapshots', () => {
    const { sessions } = parseSessionCsvRows([
      { '날짜': '2026-09-02', '세션명': '저녁', '조원 명단': '김철수(임원), 영희*' },
      { '날짜': '2026-09-02', '세션명': '저녁', '조원 명단': '철수👑' },
      { '날짜': '2026-09-02', '세션명': '오후', '조원 명단': '김철수' },
    ], ['날짜', '세션명', '조원 명단'], members, games);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ name: '저녁', boardMemberIds: ['m1', 'm2'] });
    expect(sessions[0]?.groups).toHaveLength(2);
    expect(sessions[1]).toMatchObject({ name: '오후', boardMemberIds: [] });
  });

  it('reports all unknown games once and imports no partial sessions', () => {
    expect(parseSessionCsvRows([
      { '날짜': '2026-09-02', '플레이한 게임들': '스플렌더, 없는 게임' },
      { '날짜': '2026-09-03', '플레이한 게임들': '없는 게임, 다른 게임' },
    ], [], members, games)).toEqual({ sessions: [], missingGames: ['없는 게임', '다른 게임'] });
  });

  it('skips rows without a date and retains empty groups when member names cannot be matched', () => {
    const { sessions } = parseSessionCsvRows([
      { '날짜': ' ', '조원 명단': '철수' },
      { '날짜': '2026-09-02', '조원 명단': '알 수 없는 이름' },
    ], [], members, games);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.groups[0]).toMatchObject({ memberIds: [], gameIds: [], targetSize: 4 });
  });
});
