import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDailyPlanning, renameDailyPlanningGroup, restoreDailyPlanningVersion } from './dailyPlanningService';

const transaction = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const addAuditEventToTransaction = vi.hoisted(() => vi.fn());
vi.mock('../lib/firebase', () => ({ db: {}, auth: { currentUser: { email: 'admin@example.com' } } }));
vi.mock('./auditService', () => ({ addAuditEventToTransaction }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  doc: (_db: unknown, ...path: string[]) => path.length ? path.join('/') : `${_db}/new-version`,
  serverTimestamp: () => 'server-time',
  getDocs: async () => ({ docs: [{ ref: 'DailyPlannings/2026-09-02/versions/v1' }], size: 1 }),
  runTransaction: (_db: unknown, action: (value: typeof transaction) => Promise<void>) => action(transaction),
}));

function storedDocuments(documents: Record<string, unknown>) {
  transaction.get.mockImplementation(async (ref: string) => ({
    exists: () => documents[ref] !== undefined,
    data: () => documents[ref],
  }));
}

describe('daily planning group rename', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames each current group without losing separately recorded games, members, or other groups', async () => {
    const planned = { id: 'a', name: 'Old', memberIds: ['m1'], gameIds: [] };
    const plannedOther = { id: 'b', name: 'B', memberIds: ['m2'], gameIds: [] };
    const recorded = { ...planned, memberIds: ['m1', 'late-member'], gameIds: ['recorded-game'], notes: 'Keep' };
    const recordedOther = { id: 'remote-group', memberIds: ['m3'], gameIds: ['other-game'] };
    storedDocuments({
      'DailyPlannings/2026-09-02': { groups: [planned, plannedOther], sessionId: 'linked' },
      'sessions/linked': { groups: [recorded, recordedOther] },
    });

    await renameDailyPlanningGroup('2026-09-02', 'a', 'New');

    expect(transaction.update).toHaveBeenCalledWith('DailyPlannings/2026-09-02', {
      groups: [{ ...planned, name: 'New' }, plannedOther],
    });
    expect(transaction.update).toHaveBeenCalledWith('sessions/linked', {
      groups: [{ ...recorded, name: 'New' }, recordedOther],
    });
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'session.group_renamed',
    }));
    expect(recorded.name).toBe('Old');
  });

  it('does not recreate a group that was removed from the linked session', async () => {
    storedDocuments({
      'DailyPlannings/2026-09-02': { groups: [{ id: 'a', memberIds: [], gameIds: [] }], sessionId: 'linked' },
      'sessions/linked': { groups: [] },
    });
    await renameDailyPlanningGroup('2026-09-02', 'a', 'New');
    expect(transaction.update).toHaveBeenCalledWith('sessions/linked', { groups: [] });
  });

  it('keeps legacy planning records without a valid linked document ID editable', async () => {
    storedDocuments({
      'DailyPlannings/2026-09-02': { groups: [{ id: 'a', memberIds: [], gameIds: [] }], sessionId: 'invalid/path' },
    });
    await renameDailyPlanningGroup('2026-09-02', 'a', 'New');
    expect(transaction.get).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
    await expect(renameDailyPlanningGroup('invalid/path', 'a', 'New')).rejects.toThrow('올바른 모임 ID가 아닙니다.');
  });

  it('fails before any write when the linked session no longer exists', async () => {
    storedDocuments({
      'DailyPlannings/2026-09-02': { groups: [{ id: 'a', memberIds: [], gameIds: [] }], sessionId: 'missing' },
    });
    await expect(renameDailyPlanningGroup('2026-09-02', 'a', 'New')).rejects.toThrow('세션을 찾을 수 없습니다.');
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('deletes the planning and all versions with an audit event, never touching the session', async () => {
    storedDocuments({ 'DailyPlannings/2026-09-02': {
      date: '2026-09-02', name: '모임', sessionId: 'linked', groups: [{ memberIds: ['m1', 'm2'] }],
    } });
    await deleteDailyPlanning('2026-09-02');
    expect(transaction.delete.mock.calls).toEqual([
      ['DailyPlannings/2026-09-02'], ['DailyPlannings/2026-09-02/versions/v1'],
    ]);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'session.planning_deleted', count: 2,
    }));
  });

  it('backs up current data and restores an old snapshot without modifying the linked session', async () => {
    const current = { date: '2026-09-02', name: '현재', groups: [], attendees: [{ memberId: 'm2' }], sessionId: 'linked', createdAt: 'original-time' };
    const old = { date: '2026-09-02', name: '이전', groups: [{ id: 'g1', memberIds: ['m1'], gameIds: [] }] };
    storedDocuments({
      'DailyPlannings/2026-09-02': current,
      'DailyPlannings/2026-09-02/versions/v1': { snapshot: old },
    });
    await restoreDailyPlanningVersion('2026-09-02', 'v1');
    expect(transaction.set.mock.calls).toEqual([
      ['DailyPlannings/2026-09-02/versions/new-version', expect.objectContaining({ snapshot: current, actorEmail: 'admin@example.com' })],
      ['DailyPlannings/2026-09-02', { ...old, sessionId: 'linked', createdAt: 'original-time', updatedAt: 'server-time' }],
    ]);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(transaction, expect.objectContaining({ action: 'session.planning_restored' }));
  });

  it('rejects missing records and versions before writes', async () => {
    storedDocuments({});
    await expect(deleteDailyPlanning('2026-09-02')).rejects.toThrow();
    await expect(restoreDailyPlanningVersion('2026-09-02', 'v1')).rejects.toThrow();
    await expect(deleteDailyPlanning('invalid/path')).rejects.toThrow();
    expect(transaction.delete).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).not.toHaveBeenCalled();
  });
});
