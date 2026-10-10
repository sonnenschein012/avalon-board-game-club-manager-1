import { describe, expect, it } from 'vitest';
import type { Attendee, Member, SessionGroup } from '../../types';
import { convertAttendeeIdsToMemberIds } from './sessionGroups';

describe('attendance identity conversion', () => {
  const members = [
    { id: 'first', name: '김테스트', studentId: '23' },
    { id: 'second', name: '김테스트', studentId: '23' },
  ] as Member[];
  it('persists the selected namesake and retains unmatched attendee IDs', () => {
    const attendees = [
      { id: 'selected', name: '김테스트', studentIdPrefix: '23', memberId: 'second' },
      { id: 'unregistered', name: '김테스트', studentIdPrefix: '23', memberId: null },
      { id: 'deleted', name: '김테스트', memberId: 'gone' },
      { id: 'legacy', name: '김테스트', studentIdPrefix: '99' },
    ] as Attendee[];
    const group = { id: 'group', memberIds: attendees.map(item => item.id), gameIds: ['game'], notes: 'keep' } as SessionGroup;
    expect(convertAttendeeIdsToMemberIds([group], attendees, members)).toEqual([
      { ...group, memberIds: ['second', 'unregistered', 'deleted', 'first'] },
    ]);
    expect(group.memberIds).toEqual(['selected', 'unregistered', 'deleted', 'legacy']);
  });
});
