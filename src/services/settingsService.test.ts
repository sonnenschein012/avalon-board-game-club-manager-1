import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { AdminAlreadyExistsError, addAdminRecord } from './settingsService';

const transaction = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const addAuditEventToTransaction = vi.hoisted(() => vi.fn());
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./auditService', () => ({ addAuditEventToBatch: vi.fn(), addAuditEventToTransaction }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), getDocs: vi.fn(), writeBatch: vi.fn(),
  doc: vi.fn((_db, collection, id) => `${collection}/${id}`),
  serverTimestamp: () => 'SERVER_TIME',
  runTransaction: vi.fn(async (_db, action) => action(transaction)),
}));

describe('administrator creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['master', 'admin'])('rejects an existing %s without replacing its role or creation time', async role => {
    const existing = { email: 'existing@example.test', role, createdAt: 'ORIGINAL_TIME' };
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => existing });

    await expect(addAdminRecord(existing.email)).rejects.toBeInstanceOf(AdminAlreadyExistsError);

    expect(transaction.set).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).not.toHaveBeenCalled();
    expect(existing).toEqual({ email: 'existing@example.test', role, createdAt: 'ORIGINAL_TIME' });
  });

  it('creates a new operator and its audit event in the same transaction', async () => {
    transaction.get.mockResolvedValueOnce({ exists: () => false });

    await addAdminRecord('new@example.test');

    expect(transaction.get).toHaveBeenCalledWith('admins/new@example.test');
    expect(transaction.set).toHaveBeenCalledWith('admins/new@example.test', {
      email: 'new@example.test', role: 'admin', createdAt: 'SERVER_TIME',
    });
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(transaction, expect.objectContaining({
      category: 'admin', action: 'admin.added', targetId: 'new@example.test',
    }));
  });

  it('rejects a concurrent registration discovered when Firestore retries the transaction', async () => {
    const abandonedAttempt = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    const retry = { get: vi.fn().mockResolvedValue({ exists: () => true }), set: vi.fn() };
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, action) => {
      await action(abandonedAttempt as never);
      // Firestore discards the first attempt after another client creates the document.
      return action(retry as never);
    });

    await expect(addAdminRecord('concurrent@example.test')).rejects.toBeInstanceOf(AdminAlreadyExistsError);

    expect(retry.get).toHaveBeenCalledWith('admins/concurrent@example.test');
    expect(retry.set).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).toHaveBeenCalledTimes(1);
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(abandonedAttempt, expect.anything());
  });
});
