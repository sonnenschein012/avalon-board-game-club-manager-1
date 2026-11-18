import { collection, doc, getDoc, getDocs, query, where, deleteField, Timestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Session, StoredSessionGroup } from '../types';
import type { ImportedSession } from '../domain/sessions/sessionCsv';
import { mergeSessionGroups, normalizeSessionGroup } from '../domain/sessions/sessionGroups';
import { addAuditEventToBatch, addAuditEventToTransaction } from './auditService';
import type { AuditChange } from '../domain/audit/auditEvent';

interface SessionDraft {
  name: string;
  date: string;
  groups: StoredSessionGroup[];
}

function dateKey(value: Session['date'] | string): string {
  if (typeof value === 'string') return value;
  return value?.toDate?.().toISOString().slice(0, 10) ?? '';
}

function groupsSummary(groups: readonly StoredSessionGroup[]): string {
  return groups.map((group, index) => (
    `${group.name || `TEAM ${index + 1}`} ${group.memberIds.length + (group.guestCount ?? 0)}명 (게스트 ${group.guestCount ?? 0}명) · 게임 ${group.gameIds.length}개`
  )).join(' / ');
}

function sessionChanges(current: Session, draft: SessionDraft, nextGroups: StoredSessionGroup[]): AuditChange[] {
  const candidates: AuditChange[] = [
    { field: 'name', label: '세션명', before: current.name, after: draft.name },
    { field: 'date', label: '날짜', before: dateKey(current.date), after: draft.date },
    { field: 'groups', label: '조 편성', before: groupsSummary(current.groups), after: groupsSummary(nextGroups) },
  ];
  return candidates.filter(change => change.before !== change.after);
}

export async function importSessionRecords(sessions: readonly ImportedSession[]) {
  // A single atomic import rejects every collision rather than overwriting history.
  if (sessions.length > 400) throw new Error('한 번에 400개 이하의 세션을 가져와 주세요.');
  const records = sessions.map(session => ({ session, ref: session.id ? doc(db, 'sessions', session.id) : doc(collection(db, 'sessions')) }));
  await runTransaction(db, async transaction => {
    const snapshots = await Promise.all(records.map(record => transaction.get(record.ref)));
    if (snapshots.some(snapshot => snapshot.exists())) throw new Error('이미 존재하는 세션 ID가 있습니다. 기존 기록 보호를 위해 가져오기를 취소했습니다.');
    records.forEach(({ session, ref }) => {
      const { id: _id, ...data } = session;
      void _id;
      transaction.set(ref, {
        ...data,
        date: Timestamp.fromDate(new Date(session.date)),
        groups: session.groups.map(group => normalizeSessionGroup({ ...group, id: group.id || doc(collection(db, 'sessions')).id })),
      });
    });
    if (records.length) addAuditEventToTransaction(transaction, { category: 'session', action: 'session.imported', targetLabel: `모임 기록 ${records.length}개`, count: records.length });
  });
}

export async function createSessionRecord(draft: SessionDraft, boardMemberIds: string[]) {
  const sessionRef = doc(collection(db, 'sessions'));
  const batch = writeBatch(db);
  batch.set(sessionRef, {
    name: draft.name,
    date: Timestamp.fromDate(new Date(draft.date)),
    groups: draft.groups.map(normalizeSessionGroup),
    boardMemberIds,
  });
  addAuditEventToBatch(batch, {
    category: 'session',
    action: 'session.created',
    targetId: sessionRef.id,
    targetLabel: draft.name,
    detail: `${draft.date} · ${groupsSummary(draft.groups)}`,
  });
  await batch.commit();
}

export async function updateSessionRecord(
  sessionId: string,
  draft: SessionDraft,
  initialGroups: readonly StoredSessionGroup[] | null,
) {
  const ref = doc(db, 'sessions', sessionId);
  const snapshot = await getDoc(ref);
  const current = snapshot.exists() ? snapshot.data() as Session : undefined;
  if (!current) throw new Error('세션을 찾을 수 없습니다.');
  const nextGroups = mergeSessionGroups(current.groups || [], initialGroups, draft.groups);
  const batch = writeBatch(db);
  batch.update(ref, {
    name: draft.name,
    date: Timestamp.fromDate(new Date(draft.date)),
    groups: nextGroups,
    ...(current.boardMemberIds !== undefined ? { boardMemberIds: current.boardMemberIds } : {}),
  });
  const changes = sessionChanges(current, draft, nextGroups);
  if (changes.length > 0) {
    addAuditEventToBatch(batch, {
      category: 'session',
      action: 'session.updated',
      targetId: sessionId,
      targetLabel: draft.name,
      changes,
    });
  }
  await batch.commit();
}

export async function updateSessionGroupGames(
  sessionId: string,
  groupId: string,
  gameIds: string[],
  gameTitlesById: ReadonlyMap<string, string> = new Map(),
) {
  const ref = doc(db, 'sessions', sessionId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('세션을 찾을 수 없습니다.');
  const groups = (snapshot.data() as Session).groups || [];
  const targetGroup = groups.find(group => group.id === groupId);
  if (!targetGroup) throw new Error('해당 조를 찾을 수 없습니다.');
  const gameLabels = (ids: string[]) => ids.map(id => gameTitlesById.get(id) ?? id).join(', ') || '없음';
  const batch = writeBatch(db);
  batch.update(ref, {
    groups: groups.map(group => group.id === groupId ? { ...group, gameIds } : group),
  });
  const changes = [{
      field: 'gameIds',
      label: '플레이 게임',
      before: gameLabels(targetGroup.gameIds || []),
      after: gameLabels(gameIds),
  }].filter(change => change.before !== change.after);
  if (changes.length > 0) {
    addAuditEventToBatch(batch, {
      category: 'session',
      action: 'session.group_games_updated',
      targetId: sessionId,
      targetLabel: `${(snapshot.data() as Session).name} · ${targetGroup.name || '조'}`,
      changes,
    });
  }
  await batch.commit();
}

export async function deleteSessionRecord(sessionId: string, sessionName = '모임 기록') {
  const linkedPlannings = await getDocs(query(collection(db, 'DailyPlannings'), where('sessionId', '==', sessionId)));
  // Keep deletion and detachment atomic; never delete only part of the links.
  if (linkedPlannings.size + 2 > 500) throw new Error('연결된 모임이 너무 많아 삭제할 수 없습니다.');
  const batch = writeBatch(db);
  linkedPlannings.docs.forEach(planning => batch.update(planning.ref, { sessionId: deleteField() }));
  batch.delete(doc(db, 'sessions', sessionId));
  addAuditEventToBatch(batch, {
    category: 'session',
    action: 'session.deleted',
    targetId: sessionId,
    targetLabel: sessionName,
  });
  await batch.commit();
}
