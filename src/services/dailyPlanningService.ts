import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DailyPlanning } from '../domain/attendance/dailyPlanning';
import { isSingleDocumentId } from '../domain/shared/documentId';
import type { Session } from '../types';
import { addAuditEventToTransaction } from './auditService';

/** Renames a shared group without replacing independently edited session records. */
export async function renameDailyPlanningGroup(planningId: string, groupId: string, name: string) {
  if (!isSingleDocumentId(planningId)) throw new Error('올바른 모임 ID가 아닙니다.');
  const planningRef = doc(db, 'DailyPlannings', planningId);
  await runTransaction(db, async transaction => {
    const planningSnapshot = await transaction.get(planningRef);
    if (!planningSnapshot.exists()) throw new Error('모임을 찾을 수 없습니다.');
    const planning = planningSnapshot.data() as DailyPlanning;
    if (!planning.groups.some(group => group.id === groupId)) throw new Error('해당 조를 찾을 수 없습니다.');

    const sessionRef = typeof planning.sessionId === 'string' && isSingleDocumentId(planning.sessionId)
      ? doc(db, 'sessions', planning.sessionId)
      : null;
    const sessionSnapshot = sessionRef ? await transaction.get(sessionRef) : null;
    if (sessionSnapshot && !sessionSnapshot.exists()) throw new Error('세션을 찾을 수 없습니다.');

    transaction.update(planningRef, {
      groups: planning.groups.map(group => group.id === groupId ? { ...group, name } : group),
    });
    if (sessionRef && sessionSnapshot) {
      const session = sessionSnapshot.data() as Session;
      transaction.update(sessionRef, {
        groups: session.groups.map(group => group.id === groupId ? { ...group, name } : group),
      });
    }
    const group = planning.groups.find(item => item.id === groupId);
    const previousName = group?.name || '이름 없음';
    if (previousName !== name) {
      addAuditEventToTransaction(transaction, {
        category: 'session',
        action: 'session.group_renamed',
        targetId: planning.sessionId ?? planningId,
        targetLabel: planning.name,
        changes: [{
          field: 'groupName',
          label: '조 이름',
          before: previousName,
          after: name,
        }],
      });
    }
  });
}
