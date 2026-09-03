import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Member, Session } from '../../types';
import { buildGamesCsv, buildMembersCsv, buildSessionsCsv } from './clubCsv';

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'member-1',
  name: '회원',
  nickname: '',
  studentId: '',
  phone: '',
  gender: '기타',
  semester: '2025-1',
  preferredGenre: [],
  createdAt: Timestamp.fromDate(new Date('2025-03-01T00:00:00Z')),
  ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  date: Timestamp.fromDate(new Date('2026-09-01T00:00:00Z')),
  name: '',
  groups: [{ id: 'group-1', memberIds: ['member-1'], gameIds: [] }],
  ...overrides,
});

describe('club backup CSV', () => {
  it('preserves member columns, status defaults, occurrence counts and quoted multiline cells', () => {
    const members = [
      member({
        name: 'Kim, "A"',
        nickname: '25 Kim',
        studentId: '2501',
        phone: '010-1234-5678',
        gender: '남',
        isBoardMember: true,
        preferredGenre: ['전략', '협력'],
        memo: '첫 줄\n다음 줄',
      }),
      member({ id: 'member-2', name: '휴면 회원', semester: '2024-2', status: '휴면', dormantSemester: '2026-1' }),
    ];
    const sessions = [
      session(),
      session({ groups: [
        { id: 'first', memberIds: ['member-1', 'deleted-member'], gameIds: [] },
        { id: 'second', memberIds: ['member-1'], gameIds: [] },
      ] }),
    ];

    expect(buildMembersCsv(members, sessions)).toBe([
      '이름,닉네임,학번,연락처,성별,가입학기,상태,휴면학기,임원여부,선호장르,누적참석횟수,메모',
      '"Kim, ""A""",25 Kim,2501,010-1234-5678,남,2025-1,활동,,Y,"전략, 협력",3,"첫 줄\n다음 줄"',
      '휴면 회원,,,,기타,2024-2,휴면,2026-1,N,,0,',
    ].join('\n'));
  });

  it('preserves game columns, zero values, optional blanks, genre separators and LF CSV escaping', () => {
    expect(buildGamesCsv([
      { id: 'basic', title: '기본' },
      {
        id: 'expanded', title: '확장, "판"', minPlayers: 1, maxPlayers: 4,
        bestMinPlayers: 2, bestMaxPlayers: 3, complexity: 0, genres: ['전략', '추리'], memo: '메모\n다음',
      },
      { id: 'carriage', title: '복귀', memo: '한\r줄' },
    ])).toBe([
      '게임명,최소인원,최대인원,추천최소인원,추천최대인원,난이도,장르,메모',
      '기본,,,,,,,',
      '"확장, ""판""",1,4,2,3,0,전략/추리,"메모\n다음"',
      '복귀,,,,,,,한\r줄',
    ].join('\n'));
  });

  it('keeps archived board snapshots, explicit empty snapshots and legacy current-roster fallback distinct', () => {
    const membersById = new Map([
      ['current', member({ id: 'current', name: '현재 임원', isBoardMember: true })],
      ['past', member({ id: 'past', name: '이름', nickname: '전 임원', isBoardMember: false })],
      ['blank', member({ id: 'blank', name: '' })],
    ]);
    const groups = [{ id: 'group', memberIds: ['current', 'past', 'deleted', 'blank'], gameIds: [] }];
    const sessions = [
      session({ name: '스냅샷', groups, boardMemberIds: ['past', 'deleted'] }),
      session({ name: '빈 스냅샷', groups, boardMemberIds: [], date: Timestamp.fromDate(new Date('2026-09-03T00:00:00Z')) }),
      session({ name: '이전 기록', groups, date: Timestamp.fromDate(new Date('2026-09-02T00:00:00Z')) }),
    ];

    expect(buildSessionsCsv(sessions, membersById, new Map())).toBe([
      '날짜,세션명,조 이름,조원 명단,플레이한 게임들',
      '2026-09-03,빈 스냅샷,TEAM 1,"현재 임원, 전 임원, Unknown, Unknown",',
      '2026-09-02,이전 기록,TEAM 1,"현재 임원(임원), 전 임원, Unknown, Unknown",',
      '2026-09-01,스냅샷,TEAM 1,"현재 임원, 전 임원(임원), Unknown(임원), Unknown",',
    ].join('\n'));
  });

  it('preserves UTC dates, fallback names, group order and both stored game IDs and legacy titles', () => {
    const sessions = [session({
      date: Timestamp.fromDate(new Date('2026-09-02T00:30:00+09:00')),
      groups: [
        { id: 'first', memberIds: [], gameIds: ['game-1', '아발론', 'removed-game'] },
        { id: 'second', name: '친구, 모임', memberIds: [], gameIds: [] },
      ],
    })];

    expect(buildSessionsCsv(sessions, new Map(), new Map([['game-1', '아발론']]))).toBe([
      '날짜,세션명,조 이름,조원 명단,플레이한 게임들',
      '2026-09-01,2026-09-01 정기 모임,TEAM 1,,"아발론, 아발론, removed-game"',
      '2026-09-01,2026-09-01 정기 모임,"친구, 모임",,',
    ].join('\n'));
  });

  it('retains locale date formatting for legacy dates without a Timestamp conversion', () => {
    const date = new Date(2026, 8, 2, 12);
    const legacySession = session({ date: date as unknown as Timestamp, groups: [{ id: 'empty', memberIds: [], gameIds: [] }] });
    const expectedDate = date.toLocaleDateString();

    expect(buildSessionsCsv([legacySession], new Map(), new Map())).toBe([
      '날짜,세션명,조 이름,조원 명단,플레이한 게임들',
      `${expectedDate},${expectedDate} 정기 모임,TEAM 1,,`,
    ].join('\n'));
  });
});
