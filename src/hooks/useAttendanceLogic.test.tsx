import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttendanceLogic } from './useAttendanceLogic';
import { archiveDailyPlanning } from '../services/dailyPlanningService';
import { createAttendanceMemberDraft } from '../domain/members/attendanceRegistration';

const mocks = vi.hoisted(() => ({ commit: vi.fn(), get: vi.fn(), set: vi.fn(), update: vi.fn(), register: vi.fn(), extraAttendees: [] as unknown[], clear: vi.fn(), remove: vi.fn(), navigate: vi.fn(), importRows: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: { WRITE: 'write' } }));
vi.mock('../services/auditService', () => ({ addAuditEventToTransaction: vi.fn() }));
vi.mock('../services/dailyPlanningService', () => ({ archiveDailyPlanning: vi.fn() }));
vi.mock('../services/attendeesService', () => ({
  deleteAttendeeRecord: mocks.remove, clearAllAttendees: mocks.clear,
  quickAddMemberRecord: mocks.register, manualAddAttendeeRecord: vi.fn(), importAttendanceRows: mocks.importRows,
}));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: vi.fn((_db: unknown, collection: string, id: string) => `${collection}/${id}`), getDoc: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
  runTransaction: async (_db: unknown, callback: (transaction: unknown) => Promise<void>) => {
    await callback({ get: mocks.get, update: mocks.update, set: mocks.set });
    await mocks.commit();
  },
}));
vi.mock('./useFirestore', () => {
  const data: Record<string, unknown[]> = {
    attendees: [{ id: 'a1', name: '김테스트', studentIdPrefix: '26', drink: '아이스티', request: '쉬운 게임' }],
    members: [{ id: 'm1', name: '김테스트', studentId: '260001', semester: '2026-2', gender: '남' }], sessions: [],
  };
  return { useFirestore: (collection: string) => ({ data: collection === 'attendees' ? [...data.attendees!, ...mocks.extraAttendees] : data[collection], loading: false }) };
});

describe('attendance working draft', () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: ReturnType<typeof useAttendanceLogic>;
  let scope: string;
  let counter = 0;
  function Harness({ owner }: { owner: string }) {
    latest = useAttendanceLogic({ draftScope: owner, onMoveToRecord: mocks.navigate });
    return null;
  }
  const mount = (owner = scope) => act(() => root.render(<Harness key={owner} owner={owner} />));
  const leave = () => act(() => root.render(null));
  const arrange = () => act(() => {
    latest.setSessionName('편성하던 모임');
    latest.setSessionDate('2026-09-12');
    latest.setGroups([{ id: 'g1', name: '즐거운 조', memberIds: ['a1'], gameIds: [], targetSize: 5, notes: '메모' }]);
    latest.setIsAutoMode(true);
  });
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.extraAttendees = [];
    mocks.commit.mockResolvedValue(undefined);
    mocks.get.mockResolvedValue({ exists: () => false, data: () => undefined });
    mocks.clear.mockResolvedValue(true);
    mocks.remove.mockResolvedValue(true);
    scope = `test-${++counter}`;
    sessionStorage.clear();
    container = document.createElement('div');
    root = createRoot(container);
    mount();
  });
  afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); container.remove(); });

  it('opens registration without writing and closes only after successful confirmation', async () => {
    const attendee = latest.attendees[0]!;
    act(() => latest.handleQuickAddMember(attendee));
    expect(mocks.register).not.toHaveBeenCalled();
    expect(latest.registeringAttendee).toEqual(attendee);
    mocks.register.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const draft = { ...createAttendanceMemberDraft(attendee), gender: '여' as const };
    await act(async () => { await latest.handleRegisterMember(draft); });
    expect(latest.registeringAttendee).toEqual(attendee);
    await act(async () => { await latest.handleRegisterMember(draft); });
    expect(latest.registeringAttendee).toBeNull();
    expect(mocks.register).toHaveBeenCalledWith(attendee, draft);
  });

  it('updates only assigned attendees and preserves waiting and absent people', async () => {
    mocks.extraAttendees = [{ id: 'waiting', name: '대기자', status: '대기' }, { id: 'absent', name: '결석자', status: '결석' }];
    arrange();
    await act(async () => { await latest.handleMoveToRecord(); });
    expect(mocks.update.mock.calls).toEqual([['attendees/a1', { status: '편성됨' }]]);
    expect(mocks.set.mock.calls[0]![1].attendees.map((item: { id: string }) => item.id)).toEqual(['a1']);
  });

  it('restores all working fields and assignments after leaving the page', () => {
    arrange();
    const groups = latest.groups;
    leave(); mount();
    expect(latest.groups).toEqual(groups);
    expect(latest.sessionName).toBe('편성하던 모임');
    expect(latest.sessionDate).toBe('2026-09-12');
    expect(latest.isAutoMode).toBe(true);
    expect(latest.unassignedAttendees).toHaveLength(0);
    act(() => latest.setSessionDate('2026-09-13'));
    expect(latest.sessionName).toBe('편성하던 모임');
  });
  it('moves a card atomically, returns it to the pool and ignores invalid destinations', () => {
    arrange();
    act(() => latest.setGroups(current => [...current, { id: 'g2', memberIds: [], gameIds: [] }]));
    act(() => latest.handleMoveAttendee('a1', 'g2'));
    act(() => latest.handleMoveAttendee('a1', 'g2'));
    expect(latest.groups.map(group => group.memberIds)).toEqual([[], ['a1']]);
    act(() => latest.handleMoveAttendee('a1', 'missing-group'));
    act(() => latest.handleMoveAttendee('missing-attendee', 'g1'));
    expect(latest.groups.map(group => group.memberIds)).toEqual([[], ['a1']]);
    leave(); mount();
    expect(latest.groups.map(group => group.memberIds)).toEqual([[], ['a1']]);
    act(() => latest.handleMoveAttendee('a1', null));
    expect(latest.groups.map(group => group.memberIds)).toEqual([[], []]);
    expect(latest.unassignedAttendees.map(attendee => attendee.id)).toEqual(['a1']);
  });
  it('keeps accounts separate and restores serialized data for a fresh owner', () => {
    arrange();
    const stored = sessionStorage.getItem(`avalon:attendance-draft:v1:${scope}`)!;
    mount(`${scope}-other`);
    expect(latest.groups).toEqual([]);
    sessionStorage.setItem(`avalon:attendance-draft:v1:${scope}-reload`, stored);
    mount(`${scope}-reload`);
    expect(latest.groups[0]?.memberIds).toEqual(['a1']);
    expect(latest.sessionName).toBe('편성하던 모임');
  });
  it('retains the draft on save failure, then clears it only after a successful save', async () => {
    arrange();
    mocks.commit.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await latest.handleMoveToRecord(); });
    expect(mocks.navigate).not.toHaveBeenCalled();
    leave(); mount();
    expect(latest.groups).toHaveLength(1);
    await act(async () => { await latest.handleMoveToRecord(); });
    expect(mocks.navigate).toHaveBeenCalledOnce();
    leave(); mount();
    expect(latest.groups).toEqual([]);
  });
  it('preserves failed resets and persists an explicit successful roster reset', async () => {
    arrange();
    mocks.clear.mockResolvedValueOnce(false);
    await act(async () => { await latest.clearRecords(); });
    expect(latest.groups).toHaveLength(1);
    await act(async () => { await latest.clearRecords(); });
    leave(); mount();
    expect(latest.groups).toEqual([]);
  });
  it('saves member-linked drinks and requests with the planning and leaves it untouched on reset', async () => {
    arrange();
    await act(async () => { await latest.handleMoveToRecord(); });
    const planning = mocks.set.mock.calls[0]![1];
    expect(planning.attendees).toEqual([expect.objectContaining({
      memberId: 'm1', drink: '아이스티', request: '쉬운 게임',
    })]);
    expect(mocks.set.mock.calls[1]![1]).not.toHaveProperty('attendees');
    mocks.set.mockClear();
    await act(async () => { await latest.clearRecords(); });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(planning.attendees[0].drink).toBe('아이스티');
  });
  it('archives the previous planning when overwriting and preserves an existing session', async () => {
    arrange();
    const previous = { name: '이전 모임', date: '2026-09-12', sessionId: 'linked', groups: [], attendees: [], createdAt: 'original-time' };
    mocks.get.mockResolvedValueOnce({ exists: () => true, data: () => previous });
    mocks.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ groups: [{ gameIds: ['recorded-game'] }] }) });
    await act(async () => { await latest.handleMoveToRecord(); });
    expect(archiveDailyPlanning).toHaveBeenCalledWith(expect.anything(), '2026-09-12', previous, '모임 다시 시작 전');
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set.mock.calls[0]![1]).toEqual(expect.objectContaining({
      name: '편성하던 모임', sessionId: 'linked', createdAt: 'original-time',
      attendees: [expect.objectContaining({ drink: '아이스티' })],
    }));
  });
  it('removes a deleted attendee from the saved working groups', async () => {
    arrange();
    act(() => latest.setAttendeeToDelete(latest.attendees[0]!));
    await act(async () => { await latest.handleDeleteAttendee(); });
    leave(); mount();
    expect(latest.groups[0]?.memberIds).toEqual([]);
  });
  it('keeps assignments on failed import and resets them only after successful replacement', async () => {
    arrange();
    const input = { headers: [], rows: [], mapping: { name: 0, studentIdPrefix: -2, drink: -2, afterparty: -2, request: -2 } };
    mocks.importRows.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(async () => { expect(await latest.handleImportAttendance(input)).toBe(false); });
    expect(latest.groups).toHaveLength(1);
    expect(latest.importing).toBe(false);
    await act(async () => { expect(await latest.handleImportAttendance(input)).toBe(true); });
    leave(); mount();
    expect(latest.groups).toEqual([]);
  });
  it('survives blocked browser storage and ignores invalid stored data', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    arrange(); leave(); mount();
    expect(latest.groups).toHaveLength(1);
    vi.restoreAllMocks();
    sessionStorage.setItem(`avalon:attendance-draft:v1:${scope}-bad`, '{"groups":[{}]}');
    mount(`${scope}-bad`);
    expect(latest.groups).toEqual([]);
    act(() => latest.setSessionDate('2026-09-15'));
    expect(latest.sessionName).toBe('2026. 9. 15. 정기 모임');
  });
});
