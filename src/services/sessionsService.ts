import { collection, doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import type { Session, StoredSessionGroup } from '../types';
import type { ImportedSession } from '../domain/sessions/sessionCsv';
import { mergeSessionGroups, normalizeSessionGroup } from '../domain/sessions/sessionGroups';
import { addAuditEventToBatch, createAuditEventOperation } from './auditService';
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
    `${group.name || `TEAM ${index + 1}`} ${group.memberIds.length}명 · 게임 ${group.gameIds.length}개`
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
  const operations: Parameters<typeof commitBatchesInChunks>[1] = sessions.map(session => ({
    type: 'set',
    ref: doc(collection(db, 'sessions')),
    data: {
      ...session,
      date: Timestamp.fromDate(new Date(session.date)),
      groups: session.groups.map(group => ({ ...group, id: Math.random().toString(36).substring(7) })),
    },
  }));
  if (sessions.length > 0) {
    operations.push(createAuditEventOperation({
      category: 'session',
      action: 'session.imported',
      targetLabel: `모임 기록 ${sessions.length}개`,
      count: sessions.length,
      detail: sessions.map(session => `${session.date} ${session.name}`).join(', '),
    }));
  }
  await commitBatchesInChunks(db, operations);
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
    detail: `${draft.date} · ${draft.groups.length}개 조`,
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
  const batch = writeBatch(db);
  batch.delete(doc(db, 'sessions', sessionId));
  addAuditEventToBatch(batch, {
    category: 'session',
    action: 'session.deleted',
    targetId: sessionId,
    targetLabel: sessionName,
  });
  await batch.commit();
}
