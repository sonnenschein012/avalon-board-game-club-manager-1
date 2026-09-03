import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, updateDoc } from 'firebase/firestore';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { importSessionRecords, updateSessionGroupGames, updateSessionRecord } from './sessionsService';

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/chunkBatch', () => ({ commitBatchesInChunks: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(), collection: vi.fn(), deleteDoc: vi.fn(), doc: vi.fn(),
  getDoc: vi.fn(), updateDoc: vi.fn(), Timestamp: { fromDate: (date: Date) => date },
}));

describe('session persistence boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

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

    expect(updateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
      name: 'Renamed', groups: [remote], boardMemberIds: ['past-board-member'],
    }));
  });

  it('changes only games on the requested group and rejects a missing group', async () => {
    const selected = { id: 'selected', name: 'Current name', memberIds: ['member'], gameIds: ['old'] };
    const other = { id: 'other', memberIds: [], gameIds: ['keep'] };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ groups: [selected, other] }) } as never);

    await updateSessionGroupGames('session', 'selected', ['new']);
    expect(updateDoc).toHaveBeenCalledWith(undefined, { groups: [{ ...selected, gameIds: ['new'] }, other] });

    await expect(updateSessionGroupGames('session', 'missing', [])).rejects.toThrow('해당 조를 찾을 수 없습니다.');
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});
