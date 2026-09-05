import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renameDailyPlanningGroup } from './dailyPlanningService';

const transaction = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const addAuditEventToTransaction = vi.hoisted(() => vi.fn());
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./auditService', () => ({ addAuditEventToTransaction }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
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
});
