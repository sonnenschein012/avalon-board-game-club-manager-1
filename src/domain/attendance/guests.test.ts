import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import Papa from 'papaparse';
import type { Attendee, Member, Session, SessionGroup } from '../../types';
import { attendeeMember, guestRelationWarnings, validateGuestInvitation } from './guests';
import { convertAttendeeIdsToMemberIds } from './sessionGroups';
import { calculateGroupAverageAttendance } from './attendanceHelpers';
import { moveAttendee } from './moveAttendee';
import { buildUtilityContext, combineScores, evaluateUtilityGroup, getRequestNotices, pairKey } from '../matching/personalUtility';
import { simulateAutoAssign } from '../matching/autoAssignAlgorithm';
import { mergeSessionGroups, normalizeSessionGroup } from '../sessions/sessionGroups';
import { buildMembersCsv, buildSessionsCsv } from '../exports/clubCsv';
import { parseSessionCsvRows } from '../sessions/sessionCsv';
import { detectAttendanceMapping, previewAttendanceCsv } from './csvParser';
import { generateDrinkOrderText } from '../meeting/progressHelpers';

const now = Timestamp.fromDate(new Date('2026-10-01T12:00:00Z'));
const members = Array.from({ length: 6 }, (_, i): Member => ({ id: `m${i}`, name: i < 2 ? '동명이인' : `회원${i}`, nickname: `닉${i}`, studentId: '23', gender: '남', phone: '', semester: '2026-2', preferredGenre: [], createdAt: now }));
const attendees: Attendee[] = members.map((m, i) => ({ id: `a${i}`, memberId: m.id, name: m.name, request: '', importDate: now, importId: 'test', status: '대기' }));
const guest = (id = 'guest', inviter = 'a1'): Attendee => ({ id, memberId: null, participantType: 'guest', invitedByAttendeeId: inviter, name: '동명이인', drink: '차', request: '', importDate: now, importId: 'test', status: '대기' });
const group = (ids: string[]): SessionGroup => ({ id: 'g', memberIds: ids, gameIds: ['game'] });

describe('guest attendance contract', () => {
  it('requires an attending registered inviter and rejects a second invitation', () => {
    expect(() => validateGuestInvitation('a1', attendees, members)).not.toThrow();
    expect(() => validateGuestInvitation('missing', attendees, members)).toThrow();
    expect(() => validateGuestInvitation('a1', [...attendees, guest()], members)).toThrow('1명');
    expect(() => validateGuestInvitation('a1', attendees.map(a => a.id === 'a1' ? { ...a, status: '결석' } : a), members)).toThrow();
    expect(() => validateGuestInvitation('a1', attendees.map(a => a.id === 'a1' ? { ...a, memberId: null } : a), members)).toThrow();
  });
  it('never resolves a guest as a same-name member, including absent memberId', () => {
    expect(attendeeMember(guest(), members)).toBeUndefined();
    const legacyGuest = guest();
    delete legacyGuest.memberId;
    expect(attendeeMember(legacyGuest, members)).toBeUndefined();
    expect(guestRelationWarnings([...attendees.filter(a => a.id !== 'a1'), guest()], members)).toHaveLength(1);
  });
  it('persists three real members and two anonymous guests, including separately assigned guests', () => {
    const roster = [...attendees, guest(), guest('guest2', 'a2')];
    const converted = convertAttendeeIdsToMemberIds([group(['a0', 'a1', 'a2', 'guest', 'guest2'])], roster, members);
    expect(converted[0]).toMatchObject({ memberIds: ['m0', 'm1', 'm2'], guestCount: 2 });
    expect(JSON.stringify(converted)).not.toContain('invitedBy');
    expect(convertAttendeeIdsToMemberIds([group(['a0', 'guest'])], roster, members)[0]).toMatchObject({ memberIds: ['m0'], guestCount: 1 });
  });
  it('allows independent movement and warns rather than blocking split requests', () => {
    const roster = [...attendees, guest()];
    const context = buildUtilityContext({ attendees: roster, members, sessions: [], assignmentDate: '2026-10-02' });
    const moved = moveAttendee([group(['a1', 'guest']), { ...group([]), id: 'other' }], 'guest', 'other');
    expect(moved[0]!.memberIds).toEqual(['a1']);
    expect(getRequestNotices(moved, context).join()).toContain('동반 요청 미충족');
    expect(context.requests.has(pairKey('guest', 'a1'))).toBe(true);
    expect(context.requests.has(pairKey('guest', 'a0'))).toBe(false);
  });
  it('includes guests in sizing and requests without inventing attributes or history', () => {
    const roster = [...attendees, guest(), guest('guest2', 'a2')];
    const context = buildUtilityContext({ attendees: roster, members, sessions: [], assignmentDate: '2026-10-02' });
    expect(context.people.get('guest')).toMatchObject({ memberId: null, gender: null, year: null, board: false });
    expect(context.exposures.get('guest')?.size).toBe(0);
    const result = simulateAutoAssign({ availableIds: roster.map(a => a.id), initialGroups: [group([]), { ...group([]), id: 'other' }], context });
    expect(result.updatedGroups.map(g => g.memberIds.length)).toEqual([4, 4]);
    expect(result.updatedGroups.flatMap(g => g.memberIds)).toContain('guest');
    expect(getRequestNotices(result.updatedGroups, context)).toEqual([]);
    const withGuest = evaluateUtilityGroup(['a0', 'guest'], context);
    const without = evaluateUtilityGroup(['a0'], context);
    expect(combineScores([withGuest]).welfare).toBe(combineScores([without]).welfare);
    expect(calculateGroupAverageAttendance(['a0', 'guest'], id => id === 'a0' ? members[0] : undefined, { m0: 6 })).toBe(6);
  });
  it('normalizes old sessions and validates counts while preserving remote edits', () => {
    const original = group(['m0']);
    expect(normalizeSessionGroup(original).guestCount).toBe(0);
    for (const count of [-1, 0.5, NaN, Infinity]) expect(() => normalizeSessionGroup({ ...original, guestCount: count })).toThrow();
    const saved = normalizeSessionGroup({ ...original, guestCount: 2 });
    const remote = { ...saved, gameIds: ['remote-game'] };
    expect(mergeSessionGroups([remote], [saved], [saved])).toEqual([remote]);
    expect(mergeSessionGroups([saved], [saved], [{ ...saved, guestCount: 3 }])[0]!.guestCount).toBe(3);
    expect(mergeSessionGroups([saved], [saved], [{ ...saved, guestCount: 1 }])[0]!.guestCount).toBe(1);
  });
  it('round trips repeated anonymous CSV tokens and keeps unknown names out of guest counts', () => {
    const sessions: Session[] = [{ id: 's', date: now, name: '모임', boardMemberIds: ['m0'], groups: [{ ...group(['m0', 'm1']), guestCount: 2 }] }];
    const csv = buildSessionsCsv(sessions, new Map(members.map(m => [m.id, m])), new Map([['game', '게임']]));
    const rows = Papa.parse<Record<string, string>>(csv, { header: true });
    const result = parseSessionCsvRows(rows.data, rows.meta.fields!, members, [{ id: 'game', title: '게임' }]);
    expect(result.sessions[0]!.groups[0]).toMatchObject({ memberIds: ['m0', 'm1'], guestCount: 2, gameIds: ['game'] });
    expect(result.sessions[0]!.boardMemberIds).toEqual(['m0']);
    expect(parseSessionCsvRows([{ 날짜: '2026-10-01', '조원 명단': '게스트, 게스트, 미확인, 게스트오타' }], ['날짜'], members, []).sessions[0]!.groups[0]).toMatchObject({ memberIds: [], guestCount: 2 });
    expect(buildMembersCsv(members, sessions)).not.toContain('게스트');
  });
  it('supports optional Google Form guest columns and retains old CSV behavior', () => {
    const headers = ['이름', '학번', '음료', '뒤풀이', '게스트 동반 여부', '게스트 이름', '게스트 희망 음료'];
    const input = { headers, mapping: detectAttendanceMapping(headers), rows: [['회원2', '23', '물', '아니오', '예', '친구', '차']] };
    expect(previewAttendanceCsv(input, members).rows[0]!.guest).toEqual({ name: '친구', drink: '차' });
    expect(previewAttendanceCsv(input, members).canImport).toBe(true);
    expect(previewAttendanceCsv({ ...input, rows: [...input.rows, ...input.rows] }, members).canImport).toBe(false);
    expect(previewAttendanceCsv({ ...input, rows: [['모르는사람', '23', '물', '아니오', '예', '친구', '차']] }, members).canImport).toBe(false);
    const old = { headers: headers.slice(0, 4), mapping: detectAttendanceMapping(headers.slice(0, 4)), rows: [input.rows[0]!.slice(0, 4)] };
    expect(previewAttendanceCsv(old, members).canImport).toBe(true);
    expect(previewAttendanceCsv(old, members).rows[0]!.guest).toBeUndefined();
  });
  it('includes guest drinks without fabricated membership', () => {
    expect(generateDrinkOrderText([group(['m0', 'guest'])], members, () => ({ ...attendees[0]!, drink: '물' }), [guest()])).toContain('물\n차');
  });
});
