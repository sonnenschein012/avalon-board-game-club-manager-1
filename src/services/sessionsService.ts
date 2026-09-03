import { addDoc, collection, deleteDoc, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import type { Session, StoredSessionGroup } from '../types';
import type { ImportedSession } from '../domain/sessions/sessionCsv';
import { mergeSessionGroups, normalizeSessionGroup } from '../domain/sessions/sessionGroups';

interface SessionDraft {
  name: string;
  date: string;
  groups: StoredSessionGroup[];
}

export async function importSessionRecords(sessions: readonly ImportedSession[]) {
  await commitBatchesInChunks(db, sessions.map(session => ({
    type: 'set',
    ref: doc(collection(db, 'sessions')),
    data: {
      ...session,
      date: Timestamp.fromDate(new Date(session.date)),
      groups: session.groups.map(group => ({ ...group, id: Math.random().toString(36).substring(7) })),
    },
  })));
}

export async function createSessionRecord(draft: SessionDraft, boardMemberIds: string[]) {
  await addDoc(collection(db, 'sessions'), {
    name: draft.name,
    date: Timestamp.fromDate(new Date(draft.date)),
    groups: draft.groups.map(normalizeSessionGroup),
    boardMemberIds,
  });
}

export async function updateSessionRecord(
  sessionId: string,
  draft: SessionDraft,
  initialGroups: readonly StoredSessionGroup[] | null,
) {
  const ref = doc(db, 'sessions', sessionId);
  const snapshot = await getDoc(ref);
  const current = snapshot.exists() ? snapshot.data() as Session : undefined;
  await updateDoc(ref, {
    name: draft.name,
    date: Timestamp.fromDate(new Date(draft.date)),
    groups: mergeSessionGroups(current?.groups || [], initialGroups, draft.groups),
    ...(current?.boardMemberIds !== undefined ? { boardMemberIds: current.boardMemberIds } : {}),
  });
}

export async function updateSessionGroupGames(sessionId: string, groupId: string, gameIds: string[]) {
  const ref = doc(db, 'sessions', sessionId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('세션을 찾을 수 없습니다.');
  const groups = (snapshot.data() as Session).groups || [];
  if (!groups.some(group => group.id === groupId)) throw new Error('해당 조를 찾을 수 없습니다.');
  await updateDoc(ref, {
    groups: groups.map(group => group.id === groupId ? { ...group, gameIds } : group),
  });
}

export async function deleteSessionRecord(sessionId: string) {
  await deleteDoc(doc(db, 'sessions', sessionId));
}
