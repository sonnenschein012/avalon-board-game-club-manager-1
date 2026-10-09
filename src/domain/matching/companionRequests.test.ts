import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Attendee, Member, Session } from '../../types';
import { buildUtilityContext, evaluateUtilityGroup, getRequestNotices, pairKey } from './personalUtility';
import { isRequestSelections, type RequestSelections } from './companionRequests';

const fixture = () => {
  const time = Timestamp.fromDate(new Date('2026-10-01T12:00:00'));
  const members: Member[] = ['홍운영', '김민수', '박민수', '이서윤', '최지수'].map((name, i) => ({
    id: `m${i}`, name, studentId: String(22 + i), nickname: '', phone: '', gender: '남', semester: '2026-2',
    preferredGenre: [], createdAt: time,
  }));
  const attendees: Attendee[] = members.map((member, i) => ({ id: `a${i}`, name: member.name, studentIdPrefix: member.studentId,
    request: i === 0 ? '민수랑 서윤과 함께 하고 싶어요.' : '', status: '대기', importId: 'synthetic', importDate: time }));
  return { members, attendees, sessions: [{ id: 'history', name: 'history', date: time,
    groups: [{ id: 'history-group', memberIds: ['m0', 'm1'], gameIds: [] }] }] as Session[],
  assignmentDate: '2026-10-09', requestSelections: {} as RequestSelections };
};

describe('companion request identity resolution', () => {
  it.each(['서윤이와 함께 사람 적은 방에서 하고 싶어요', '이번에서윤이와같이하고싶어요', '서윤쨩도같이해주세요', '서윤하고서윤이와같이'])('recognizes a unique given name in %s without requiring word boundaries or allowed particles', request => {
    const input = fixture();
    input.attendees[0]!.request = request;
    const context = buildUtilityContext(input);
    expect([...context.requests.values()]).toEqual([['a0', 'a3']]);
    expect(context.requestChoices).toEqual([]);
    const score = evaluateUtilityGroup([...context.people.keys()], context);
    expect(score.people.find(person => person.id === 'a0')!.requestCount).toBe(1);
    expect(score.people.find(person => person.id === 'a3')!.requestCount).toBe(1);
    expect(input.attendees[0]!.request).toBe(request);
  });

  it('holds namesakes even within longer text while retaining unique mentions', () => {
    const input = fixture();
    input.members[1]!.name = input.attendees[1]!.name = '김민준';
    input.members[2]!.name = input.attendees[2]!.name = '박민준';
    input.attendees[0]!.request = '민준이와 함께';
    const context = buildUtilityContext(input);
    expect(context.requests.size).toBe(0);
    expect(context.requestChoices).toHaveLength(1);
    expect(context.requestChoices[0]!.candidates.map(candidate => candidate.id)).toEqual(['a1', 'a2']);
    input.attendees[0]!.request = '국민준이와 서윤이왕';
    const longerText = buildUtilityContext(input);
    expect([...longerText.requests.values()]).toEqual([['a0', 'a3']]);
    expect(longerText.requestChoices).toHaveLength(1);
    expect(longerText.requestChoices[0]!.candidates.map(candidate => candidate.id)).toEqual(['a1', 'a2']);
  });

  it('holds an ambiguous given name while retaining independent uniquely identified requests', () => {
    const input = fixture(), context = buildUtilityContext(input);
    expect([...context.requests.values()]).toEqual([['a0', 'a3']]);
    expect(context.requestChoices).toHaveLength(1);
    expect(context.requestChoices[0]).toMatchObject({ requesterId: 'a0', mention: '민수', selectedId: null });
    expect(context.requestChoices[0]!.candidates.map(candidate => candidate.id)).toEqual(['a1', 'a2']);
    const score = evaluateUtilityGroup([...context.people.keys()], context);
    expect(score.people.find(person => person.id === 'a1')!.requestCount).toBe(0);
    expect(score.people.find(person => person.id === 'a0')!.reunionCost).toBeGreaterThan(0);
  });

  it('uses the operator-selected attendee on both sides for scores, reunion exemption and manual notices', () => {
    const input = fixture(), choice = buildUtilityContext(input).requestChoices[0]!;
    input.requestSelections[choice.key] = { signature: choice.signature, recipientId: 'a1' };
    const context = buildUtilityContext(input);
    expect(context.requests.has(pairKey('a0', 'a1'))).toBe(true);
    expect(context.requests.has(pairKey('a0', 'a2'))).toBe(false);
    const score = evaluateUtilityGroup([...context.people.keys()], context);
    expect(score.people.find(person => person.id === 'a0')).toMatchObject({ requestCount: 2, reunionCost: 0 });
    expect(score.people.find(person => person.id === 'a1')!.requestCount).toBe(1);
    expect(score.people.find(person => person.id === 'a2')!.requestCount).toBe(0);
    const apart = [{ id: 'one', memberIds: ['a0', 'a3'], gameIds: [] }, { id: 'two', memberIds: ['a1', 'a2'], gameIds: [] }];
    expect(getRequestNotices(apart, context)).toEqual([expect.stringContaining('김민수')]);
    expect(getRequestNotices([{ id: 'one', memberIds: ['a0', 'a1', 'a3'], gameIds: [] }], context)).toEqual([]);
    expect(input.attendees[0]!.request).toBe('민수랑 서윤과 함께 하고 싶어요.');
    input.requestSelections[choice.key]!.recipientId = null;
    expect(buildUtilityContext(input).requests.has(pairKey('a0', 'a1'))).toBe(false);
  });

  it('counts the current attending roster, including unassigned people, rather than outside namesakes', () => {
    const input = fixture(); input.attendees[2]!.status = '결석';
    const context = buildUtilityContext(input);
    expect(context.requestChoices).toEqual([]);
    expect(context.requests.has(pairKey('a0', 'a1'))).toBe(true);
    expect(context.absentRequests).toEqual([]);
  });

  it('prefers explicit full names and never reinterprets an absent full name as another given-name peer', () => {
    const input = fixture(); input.attendees[0]!.request = '김민수와 박민수';
    expect(buildUtilityContext(input).requests.size).toBe(2);
    expect(buildUtilityContext(input).requestChoices).toEqual([]);
    input.attendees[0]!.request = '박민수랑 함께'; input.attendees[2]!.status = '결석';
    const context = buildUtilityContext(input);
    expect(context.requests.size).toBe(0);
    expect(context.requestChoices).toEqual([]);
    expect(context.absentRequests).toEqual([{ requesterId: 'a0', requester: '홍운영', recipient: '박민수' }]);
  });

  it('finds a separate given-name mention after skipping a full-name span', () => {
    const input = fixture();
    input.attendees[0]!.request = '김민수와같이민수도같이';
    const context = buildUtilityContext(input);
    expect([...context.requests.values()]).toEqual([['a0', 'a1']]);
    expect(context.requestChoices).toHaveLength(1);
    expect(context.requestChoices[0]).toMatchObject({ mention: '민수', selectedId: null });
  });

  it('also holds full-name namesakes with distinct member and attendee IDs', () => {
    const input = fixture(); input.members[2]!.name = input.attendees[2]!.name = '김민수';
    input.attendees[0]!.request = '김민수와 함께';
    let context = buildUtilityContext(input);
    expect(context.requests.size).toBe(0);
    expect(context.requestChoices).toHaveLength(1);
    const choice = context.requestChoices[0]!;
    input.requestSelections[choice.key] = { signature: choice.signature, recipientId: 'a2' };
    context = buildUtilityContext(input);
    expect([...context.requests.values()]).toEqual([['a0', 'a2']]);
    expect(context.people.get('a1')!.memberId).toBe('m1');
    expect(context.people.get('a2')!.memberId).toBe('m2');
    input.attendees[2]!.status = '결석'; input.requestSelections = {};
    context = buildUtilityContext(input);
    expect([...context.requests.values()]).toEqual([['a0', 'a1']]);
    expect(context.absentRequests).toEqual([]);
  });

  it.each(['request', 'date', 'candidate', 'absence', 'invalid-id'])('requires confirmation again after %s changes', change => {
    const input = fixture(), choice = buildUtilityContext(input).requestChoices[0]!;
    input.requestSelections[choice.key] = { signature: choice.signature, recipientId: 'a1' };
    if (change === 'request') input.attendees[0]!.request += ' 부탁해요';
    if (change === 'date') input.assignmentDate = '2026-10-10';
    if (change === 'candidate') { input.members[4]!.name = input.attendees[4]!.name = '최민수'; }
    if (change === 'absence') input.attendees[1]!.status = '결석';
    if (change === 'invalid-id') input.requestSelections[choice.key]!.recipientId = 'a3';
    const context = buildUtilityContext(input);
    expect(context.requestChoices[0]!.selectedId).toBeNull();
    expect(context.requests.has(pairKey('a0', 'a1'))).toBe(false);
    expect(context.requests.has(pairKey('a0', 'a2'))).toBe(false);
  });

  it('does not silently remove unregistered candidates to force a unique answer', () => {
    const input = fixture(); input.members.splice(2, 1);
    const context = buildUtilityContext(input);
    expect(context.requestChoices[0]!.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'a2', name: '박민수', memberId: null }),
    ]));
    expect(context.requests.has(pairKey('a0', 'a1'))).toBe(false);
  });

  it('does not identify unknown prose or the requester', () => {
    const input = fixture(); input.attendees[0]!.request = '홍운영은 친구와 쉽게 할게요.';
    const context = buildUtilityContext(input);
    expect(context.requests.size).toBe(0);
    expect(context.requestChoices).toEqual([]);
    expect(context.absentRequests).toEqual([]);
  });

  it('retains the agreed substring limitation for a name inside an unrelated word', () => {
    const input = fixture(); input.attendees[0]!.request = '민수용품';
    const context = buildUtilityContext(input);
    expect(context.requests.size).toBe(0);
    expect(context.requestChoices).toHaveLength(1);
    expect(context.requestChoices[0]!.mention).toBe('민수');
  });

  it('validates restored selections without rejecting an explicit unconfirmed state', () => {
    expect(isRequestSelections({ key: { signature: 'current', recipientId: null } })).toBe(true);
    expect(isRequestSelections({ key: { signature: 'current', recipientId: 'a1' } })).toBe(true);
    for (const value of [[], null, { key: {} }, { key: { signature: 'current', recipientId: 1 } }]) expect(isRequestSelections(value)).toBe(false);
  });
});
