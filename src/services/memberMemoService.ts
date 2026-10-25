import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { collectAuditChanges } from '../domain/audit/auditEvent';
import { addAuditEventToTransaction } from './auditService';

export class MemberMemoConflictError extends Error {
  constructor(public readonly currentMemo: string) {
    super('다른 곳에서 메모가 변경되었습니다. 입력 내용은 유지했습니다. 최신 메모를 불러온 뒤 다시 수정해주세요.');
    this.name = 'MemberMemoConflictError';
  }
}

/** Update only the memo; never recreate a deleted member or replace other fields. */
export async function updateMemberMemo(memberId: string, expectedMemo: string, memo: string): Promise<void> {
  const ref = doc(db, 'members', memberId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('삭제된 동아리원의 메모는 저장할 수 없습니다.');
    const member = snapshot.data();
    const previousMemo = typeof member.memo === 'string' ? member.memo : '';
    if (previousMemo === memo) return;
    if (previousMemo !== expectedMemo) throw new MemberMemoConflictError(previousMemo);
    transaction.update(ref, { memo });
    addAuditEventToTransaction(transaction, {
      category: 'member', action: 'member.updated', targetId: memberId, targetLabel: member.name || '동아리원',
      changes: collectAuditChanges({ memo: previousMemo }, { memo }, [{ key: 'memo', label: '메모' }]),
    });
  });
}
