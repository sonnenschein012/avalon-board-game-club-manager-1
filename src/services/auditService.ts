import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Transaction,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AuditEvent, AuditEventInput } from '../domain/audit/auditEvent';

const AUDIT_TEXT_LIMITS = {
  targetLabel: 300,
  detail: 10_000,
  changeValue: 3_000,
  changeLabel: 200,
  maxChanges: 100,
} as const;

function truncateAuditText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}… (일부 생략)`;
}

function currentActorEmail(): string {
  // Keep the exact authenticated value: Firestore Rules compare this field
  // with the email claim in the same request.
  const email = auth.currentUser?.email?.trim();
  if (!email) throw new Error('변경 이력을 기록할 로그인 이메일을 확인할 수 없습니다.');
  return email;
}

function auditEventData(input: AuditEventInput): DocumentData {
  const targetLabel = typeof input.targetLabel === 'string' && input.targetLabel.trim()
    ? input.targetLabel.trim()
    : '대상 정보 없음';
  const changes = input.changes?.slice(0, AUDIT_TEXT_LIMITS.maxChanges).map(change => ({
    field: truncateAuditText(change.field, AUDIT_TEXT_LIMITS.changeLabel),
    label: truncateAuditText(change.label, AUDIT_TEXT_LIMITS.changeLabel),
    before: truncateAuditText(change.before, AUDIT_TEXT_LIMITS.changeValue),
    after: truncateAuditText(change.after, AUDIT_TEXT_LIMITS.changeValue),
  }));
  return {
    category: input.category,
    action: input.action,
    actorEmail: currentActorEmail(),
    occurredAt: serverTimestamp(),
    targetLabel: truncateAuditText(targetLabel, AUDIT_TEXT_LIMITS.targetLabel),
    ...(input.targetId ? { targetId: input.targetId } : {}),
    ...(changes && changes.length > 0 ? { changes } : {}),
    ...(input.detail ? { detail: truncateAuditText(input.detail, AUDIT_TEXT_LIMITS.detail) } : {}),
    ...(input.count !== undefined ? { count: input.count } : {}),
    schemaVersion: 1,
  };
}

export function createAuditEventOperation(input: AuditEventInput): {
  type: 'set';
  ref: DocumentReference;
  data: DocumentData;
} {
  return {
    type: 'set',
    ref: createAuditEventRef(),
    data: auditEventData(input),
  };
}

export function createAuditEventRef(): DocumentReference {
  return doc(collection(db, 'auditEvents'));
}

export function addAuditEventToBatch(batch: WriteBatch, input: AuditEventInput): DocumentReference {
  const eventRef = createAuditEventRef();
  batch.set(eventRef, auditEventData(input));
  return eventRef;
}

export function addAuditEventToTransaction(transaction: Transaction, input: AuditEventInput): DocumentReference {
  const eventRef = createAuditEventRef();
  transaction.set(eventRef, auditEventData(input));
  return eventRef;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const batch = writeBatch(db);
  addAuditEventToBatch(batch, input);
  await batch.commit();
}

export function subscribeAuditEvents(
  onData: (events: AuditEvent[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'auditEvents'), orderBy('occurredAt', 'desc'), limit(200)),
    snapshot => onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AuditEvent))),
    onError,
  );
}
