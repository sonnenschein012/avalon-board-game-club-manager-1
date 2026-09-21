import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, getDocs } from 'firebase/firestore';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { deleteSessionRecord, importSessionRecords, updateSessionGroupGames, updateSessionRecord } from './sessionsService';

const batch = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
const addAuditEventToBatch = vi.hoisted(() => vi.fn());
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/chunkBatch', () => ({ commitBatchesInChunks: vi.fn() }));
vi.mock('./auditService', () => ({
  addAuditEventToBatch,
  createAuditEventOperation: vi.fn(() => ({ type: 'set', ref: 'audit', data: {} })),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), writeBatch: vi.fn(() => batch),
  getDocs: vi.fn(), query: vi.fn(), where: vi.fn(), deleteField: () => 'delete-field',
  Timestamp: { fromDate: (date: Date) => date },
}));

describe('session persistence boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detaches every linked planning without changing its contents in the session deletion batch', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [{ ref: 'planning-a' }, { ref: 'planning-b' }], size: 2 } as never);
    await deleteSessionRecord('session', '모임');
    expect(batch.update.mock.calls).toEqual([
      ['planning-a', { sessionId: 'delete-field' }], ['planning-b', { sessionId: 'delete-field' }],
    ]);
    expect(batch.delete).toHaveBeenCalledOnce();
    expect(addAuditEventToBatch).toHaveBeenCalledWith(batch, expect.objectContaining({ action: 'session.deleted' }));
    expect(batch.commit).toHaveBeenCalledOnce();
  });

  it('does not delete on lookup failure and reports failed atomic commits', async () => {
    vi.mocked(getDocs).mockRejectedValueOnce(new Error('lookup failed'));
    await expect(deleteSessionRecord('session')).rejects.toThrow('lookup failed');
    expect(batch.delete).not.toHaveBeenCalled();
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [], size: 0 } as never);
    batch.commit.mockRejectedValueOnce(new Error('commit failed'));
    await expect(deleteSessionRecord('session')).rejects.toThrow('commit failed');
  });

  it('retains absent versus explicit empty imported role snapshots', async () => {
    await importSessionRecords([
      { name: 'legacy', date: '2026-09-02', groups: [] },
      { name: 'current', date: '2026-09-02', groups: [], boardMemberIds: [] },
    ]);
    const operations = vi.mocked(commitBatchesInChunks).mock.calls[0]?.[1];
    expect(operations?.[0]?.data).not.toHaveProperty('boardMemberIds');
    expect(operations?.[1]?.data).toHaveProperty('boardMemberIds', []);
  });

  it('keeps the stored board snapshot and untouched group edits when saving a session', async () => {
    const initial = { id: 'group', memberIds: ['member'], gameIds: [] };
    const remote = { ...initial, gameIds: ['recorded-game'] };
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true, data: () => ({ groups: [remote], boardMemberIds: ['past-board-member'] }),
    } as never);

    await updateSessionRecord('session', { name: 'Renamed', date: '2026-09-02', groups: [initial] }, [initial]);

    expect(batch.update).toHaveBeenCalledWith(undefined, expect.objectContaining({
      name: 'Renamed', groups: [remote], boardMemberIds: ['past-board-member'],
    }));
    expect(addAuditEventToBatch).toHaveBeenCalledWith(batch, expect.objectContaining({ action: 'session.updated' }));
  });

  it('changes only games on the requested group and rejects a missing group', async () => {
    const selected = { id: 'selected', name: 'Current name', memberIds: ['member'], gameIds: ['old'] };
    const other = { id: 'other', memberIds: [], gameIds: ['keep'] };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ groups: [selected, other] }) } as never);

    await updateSessionGroupGames('session', 'selected', ['new']);
    expect(batch.update).toHaveBeenCalledWith(undefined, { groups: [{ ...selected, gameIds: ['new'] }, other] });

    await expect(updateSessionGroupGames('session', 'missing', [])).rejects.toThrow('해당 조를 찾을 수 없습니다.');
    expect(batch.update).toHaveBeenCalledTimes(1);
  });
});
