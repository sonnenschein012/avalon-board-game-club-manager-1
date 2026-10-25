import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { MemberMemoConflictError, updateMemberMemo } from './memberMemoService';
import { addAuditEventToTransaction } from './auditService';

const transaction = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('./auditService', () => ({ addAuditEventToTransaction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => `${collection}/${id}`),
  runTransaction: vi.fn(async (_db, action) => action(transaction)),
}));

describe('member memo update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates only the memo and writes its before/after audit event atomically', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ name: '합성회원', memo: '이전', phone: 'keep', status: '휴면' }) });
    await updateMemberMemo('member-1', '이전', '새 메모\n두 번째 줄');
    expect(transaction.update).toHaveBeenCalledExactlyOnceWith('members/member-1', { memo: '새 메모\n두 번째 줄' });
    expect(addAuditEventToTransaction).toHaveBeenCalledExactlyOnceWith(transaction, {
      category: 'member', action: 'member.updated', targetId: 'member-1', targetLabel: '합성회원',
      changes: [{ field: 'memo', label: '메모', before: '이전', after: '새 메모\n두 번째 줄' }],
    });
  });

  it('supports a previously absent memo and clearing the memo', async () => {
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: '합성회원' }) });
    await updateMemberMemo('member-1', '', '추가');
    expect(transaction.update).toHaveBeenLastCalledWith('members/member-1', { memo: '추가' });
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ memo: '추가' }) });
    await updateMemberMemo('member-1', '추가', '');
    expect(transaction.update).toHaveBeenLastCalledWith('members/member-1', { memo: '' });
  });

  it('does not recreate a deleted member or overwrite a concurrently edited memo', async () => {
    transaction.get.mockResolvedValueOnce({ exists: () => false });
    await expect(updateMemberMemo('member-1', '이전', '새 메모')).rejects.toThrow('삭제된 동아리원');
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ memo: '다른 수정' }) });
    await expect(updateMemberMemo('member-1', '이전', '새 메모')).rejects.toMatchObject({ currentMemo: '다른 수정' });
    expect(transaction.update).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).not.toHaveBeenCalled();
  });

  it('rechecks the memo when Firestore retries after another editor saves', async () => {
    const abandoned = { get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ memo: '이전' }) }), update: vi.fn() };
    const retry = { get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ memo: '동시 수정' }) }), update: vi.fn() };
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, action) => {
      await action(abandoned as never);
      return action(retry as never);
    });
    await expect(updateMemberMemo('member-1', '이전', '새 메모')).rejects.toBeInstanceOf(MemberMemoConflictError);
    expect(retry.update).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).toHaveBeenCalledTimes(1);
    expect(addAuditEventToTransaction).toHaveBeenCalledWith(abandoned, expect.anything());
  });

  it('does not write or duplicate audit events if the desired memo already exists', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: '새 메모' }) });
    await updateMemberMemo('member-1', '이전', '새 메모');
    expect(transaction.update).not.toHaveBeenCalled();
    expect(addAuditEventToTransaction).not.toHaveBeenCalled();
  });
});
