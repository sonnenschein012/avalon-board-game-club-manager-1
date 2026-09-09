import { collection, doc, getDocs, runTransaction, serverTimestamp, type DocumentData, type Transaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { DailyPlanning } from '../domain/attendance/dailyPlanning';
import { isSingleDocumentId } from '../domain/shared/documentId';
import type { Session } from '../types';
import { addAuditEventToTransaction } from './auditService';

export interface DailyPlanningVersion {
  id: string;
  snapshot: DailyPlanning;
  archivedAt: { toDate?: () => Date } | null;
  actorEmail: string;
  reason: string;
}

/** Every version write also changes the parent in the same transaction. */
export function archiveDailyPlanning(transaction: Transaction, planningId: string, snapshot: DocumentData, reason: string) {
  const versionRef = doc(collection(db, 'DailyPlannings', planningId, 'versions'));
  transaction.set(versionRef, {
    snapshot,
    archivedAt: serverTimestamp(),
    actorEmail: auth.currentUser?.email ?? '',
    reason,
  });
}

export async function restoreDailyPlanningVersion(planningId: string, versionId: string): Promise<void> {
  if (!isSingleDocumentId(planningId) || !isSingleDocumentId(versionId)) throw new Error('올바른 모임 또는 버전 ID가 아닙니다.');
  const planningRef = doc(db, 'DailyPlannings', planningId);
  const versionRef = doc(db, 'DailyPlannings', planningId, 'versions', versionId);
  await runTransaction(db, async transaction => {
    const current = await transaction.get(planningRef);
    const version = await transaction.get(versionRef);
    if (!current.exists() || !version.exists()) throw new Error('모임 또는 이전 버전을 찾을 수 없습니다.');
    const snapshot = (version.data() as DailyPlanningVersion).snapshot;
    if (snapshot.date !== current.data().date) throw new Error('모임 날짜가 일치하지 않습니다.');
    archiveDailyPlanning(transaction, planningId, current.data(), '이전 버전 복원 전');
    transaction.set(planningRef, {
      name: snapshot.name,
      date: snapshot.date,
      groups: snapshot.groups,
      ...(snapshot.attendees !== undefined ? { attendees: snapshot.attendees } : {}),
      ...(current.data().sessionId ? { sessionId: current.data().sessionId } : {}),
      createdAt: current.data().createdAt,
      updatedAt: serverTimestamp(),
    });
    addAuditEventToTransaction(transaction, {
      category: 'session', action: 'session.planning_restored', targetId: planningId,
      targetLabel: snapshot.name || snapshot.date,
      detail: `${snapshot.date} · 이전 버전 ${versionId} 복원 · 복원 전 정보도 보관 · 세션 기록 유지`,
    });
  });
}

/** Delete only the operating snapshot and commit its audit event atomically. */
export async function deleteDailyPlanning(planningId: string): Promise<void> {
  if (!isSingleDocumentId(planningId)) throw new Error('올바른 모임 ID가 아닙니다.');
  const planningRef = doc(db, 'DailyPlannings', planningId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(planningRef);
    if (!snapshot.exists()) throw new Error('이미 삭제되었거나 존재하지 않는 모임입니다.');
    // Concurrent saves/restores update the parent, causing this transaction
    // (including the version listing) to retry rather than leave orphan versions.
    const versions = await getDocs(collection(db, 'DailyPlannings', planningId, 'versions'));
    const planning = snapshot.data() as DailyPlanning;
    const count = new Set(planning.groups.flatMap(group => group.memberIds)).size;
    transaction.delete(planningRef);
    versions.docs.forEach(version => transaction.delete(version.ref));
    addAuditEventToTransaction(transaction, {
      category: 'session',
      action: 'session.planning_deleted',
      targetId: planningId,
      targetLabel: planning.name || planning.date,
      count,
      detail: `${planning.date} · ${planning.groups.length}개 조 · ${count}명 · 조 구성·음료·희망사항 및 이전 버전 ${versions.size}개 삭제 · 세션 기록 유지`,
    });
  });
}

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

    if (planning.groups.find(group => group.id === groupId)?.name !== name) {
      archiveDailyPlanning(transaction, planningId, planningSnapshot.data(), '조 이름 변경 전');
    }

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
