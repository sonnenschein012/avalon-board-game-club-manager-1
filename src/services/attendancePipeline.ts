import {
  doc as defaultDoc,
  collection as defaultCollection,
  serverTimestamp,
  Timestamp,
  runTransaction as defaultRunTransaction,
  getDoc,
  Firestore,
  DocumentReference,
  CollectionReference,
  DocumentData,
} from 'firebase/firestore';
import { Attendee, Member } from '../types';
import { CurrentSheetSourceInfo } from '../types/googleWorkspace';
import { getMemberFromAttendee } from '../domain/matching/getMemberFromAttendee';

export interface ParsedAttendeeRow {
  name: string;
  studentIdPrefix: string;
  drink: string;
  afterparty: boolean;
  afterpartyPay: boolean;
  request: string;
  timeSlot?: string;
}

export interface AttendanceParseResult {
  validRows: ParsedAttendeeRow[];
  ignoredEmptyRowCount: number;
  invalidRows: Array<{ rowIndex: number; raw: unknown; reason: string }>;
  hasFatalError: boolean;
}

export interface AttendanceRevisionInfo {
  revision: number;
  fingerprint: string;
  updatedAt?: unknown;
  updatedBy?: string | null;
}

export interface AtomicReplacementParams {
  db: Firestore;
  parsedRows: ParsedAttendeeRow[];
  existingAttendees: Attendee[];
  members: Member[];
  sourceInfo?: CurrentSheetSourceInfo | null | undefined;
  allowEmptyReplacement?: boolean | undefined;
  expectedInitialRevision?: number | null | undefined;
  lockId?: string | null | undefined;
  callerEmail?: string | null | undefined;
  transactionRunner?: typeof defaultRunTransaction;
  docFactory?: (db: Firestore, ...pathSegments: string[]) => DocumentReference<DocumentData>;
  collectionFactory?: (db: Firestore, ...pathSegments: string[]) => CollectionReference<DocumentData>;
}

export interface AtomicReplacementResult {
  success: boolean;
  importedCount: number;
  wokenUpNames: string[];
  fingerprint: string;
  newRevision: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Calculates a deterministic fingerprint hash of the given attendee set.
 * Detects any addition, modification, or DELETION of attendees.
 */
export function calculateAttendeeSetFingerprint(attendees: Attendee[]): string {
  if (!attendees || attendees.length === 0) {
    return 'EMPTY_SET';
  }

  const normalizedItems = attendees.map((a) => {
    const sId = (a.studentIdPrefix || '').trim().toLowerCase();
    const name = (a.name || '').trim().toLowerCase();
    const drink = (a.drink || '').trim().toLowerCase();
    const afterparty = a.afterparty ? '1' : '0';
    const req = (a.request || '').trim().toLowerCase();
    return `${sId}:${name}:${drink}:${afterparty}:${req}`;
  });

  normalizedItems.sort();

  let hash = 0x811c9dc5;
  const fullStr = normalizedItems.join('|');
  for (let i = 0; i < fullStr.length; i++) {
    hash ^= fullStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fp_${(hash >>> 0).toString(16)}_${attendees.length}`;
}

/**
 * Retrieves the current attendance revision number from system_settings/attendance_revision.
 */
export async function getCurrentAttendanceRevision(db: Firestore): Promise<AttendanceRevisionInfo> {
  try {
    const revDocRef = defaultDoc(db, 'system_settings', 'attendance_revision');
    const snap = await getDoc(revDocRef);
    if (!snap.exists()) {
      return { revision: 0, fingerprint: 'EMPTY_SET' };
    }
    const data = snap.data();
    return {
      revision: typeof data.revision === 'number' ? data.revision : 0,
      fingerprint: data.fingerprint || 'EMPTY_SET',
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch {
    return { revision: 0, fingerprint: 'EMPTY_SET' };
  }
}

/**
 * Parses and validates 2D string rows (e.g. from Google Sheets API).
 * Zero-Loss Principle: Blank rows are skipped, but rows with data missing essential fields cause fatal validation errors.
 */
export function parseAttendance2DRows(rows: string[][]): AttendanceParseResult {
  if (!rows || rows.length === 0) {
    return { validRows: [], ignoredEmptyRowCount: 0, invalidRows: [], hasFatalError: false };
  }

  let headerRowIndex = 0;
  let nameCol = 1;
  let drinkCol = 2;
  let afterpartyCol = 3;
  let reqCol = 4;

  const firstRow = rows[0] || [];
  const hasHeader = firstRow.some(
    (cell) =>
      typeof cell === 'string' &&
      (cell.includes('이름') || cell.includes('학번') || cell.includes('타임스탬프') || cell.includes('Name'))
  );

  if (hasHeader) {
    firstRow.forEach((cell, idx) => {
      const c = (cell || '').trim();
      if (c.includes('학번') || c.includes('이름') || c.includes('Name')) nameCol = idx;
      else if (c.includes('음료')) drinkCol = idx;
      else if (c.includes('뒷풀이')) afterpartyCol = idx;
      else if (c.includes('희망') || c.includes('요청')) reqCol = idx;
    });
    headerRowIndex = 1;
  }

  const validRows: ParsedAttendeeRow[] = [];
  const invalidRows: Array<{ rowIndex: number; raw: unknown; reason: string }> = [];
  let ignoredEmptyRowCount = 0;

  for (let i = headerRowIndex; i < rows.length; i++) {
    const row = rows[i] || [];
    const isRowEmpty = row.every((cell) => !cell || cell.trim() === '');
    if (isRowEmpty) {
      ignoredEmptyRowCount++;
      continue;
    }

    const rawName = (row[nameCol] || '').trim();
    if (!rawName) {
      invalidRows.push({
        rowIndex: i + 1,
        raw: row,
        reason: '이름 필드가 비어있거나 올바르지 않습니다.',
      });
      continue;
    }

    const match = rawName.match(/^(\d{2})?\s*(.+)$/);
    const studentIdPrefix = match?.[1] || '';
    const name = match?.[2]?.trim() || rawName;

    const rawDrink = (row[drinkCol] || '').trim();
    const rawAfterparty = (row[afterpartyCol] || '').trim();
    const rawRequest = (row[reqCol] || '').trim();

    const afterparty =
      rawAfterparty.includes('네') ||
      rawAfterparty.includes('참석') ||
      rawAfterparty.includes('O') ||
      rawAfterparty.includes('o') ||
      rawAfterparty.includes('필참');

    validRows.push({
      name,
      studentIdPrefix,
      drink: rawDrink,
      afterparty,
      afterpartyPay: false,
      request: rawRequest,
    });
  }

  return {
    validRows,
    ignoredEmptyRowCount,
    invalidRows,
    hasFatalError: invalidRows.length > 0,
  };
}

/**
 * Parses and validates CSV record objects (e.g. from PapaParse).
 */
export function parseAttendanceRecordRows(records: Record<string, string>[]): AttendanceParseResult {
  if (!records || records.length === 0) {
    return { validRows: [], ignoredEmptyRowCount: 0, invalidRows: [], hasFatalError: false };
  }

  const validRows: ParsedAttendeeRow[] = [];
  const invalidRows: Array<{ rowIndex: number; raw: unknown; reason: string }> = [];
  let ignoredEmptyRowCount = 0;

  records.forEach((row, idx) => {
    const values = Object.values(row);
    const isRowEmpty = values.every((v) => !v || v.trim() === '');
    if (isRowEmpty) {
      ignoredEmptyRowCount++;
      return;
    }

    const rawName =
      row['학번 및 이름'] || row['이름'] || row['Name'] || values[1] || values[0] || '';

    if (!rawName || rawName.trim() === '') {
      invalidRows.push({
        rowIndex: idx + 1,
        raw: row,
        reason: '이름 필드가 누락되었습니다.',
      });
      return;
    }

    const match = rawName.trim().match(/^(\d{2})?\s*(.+)$/);
    const studentIdPrefix = match?.[1] || '';
    const name = match?.[2]?.trim() || rawName.trim();

    const rawDrink = row['마시고 싶은 음료'] || row['음료'] || '';
    const rawAfterparty = row['뒷풀이에 참석하시나요?'] || row['뒷풀이 여부'] || '';
    const request = row['희망사항'] || row['행사 관련 희망사항'] || row['요청사항'] || values[4] || '';

    const afterparty =
      typeof rawAfterparty === 'string' &&
      (rawAfterparty.includes('네') ||
        rawAfterparty.includes('참석') ||
        rawAfterparty.includes('O') ||
        rawAfterparty.includes('o') ||
        rawAfterparty.includes('필참'));

    validRows.push({
      name,
      studentIdPrefix,
      drink: typeof rawDrink === 'string' ? rawDrink.trim() : '',
      afterparty,
      afterpartyPay: false,
      request: typeof request === 'string' ? request.trim() : '',
    });
  });

  return {
    validRows,
    ignoredEmptyRowCount,
    invalidRows,
    hasFatalError: invalidRows.length > 0,
  };
}

/**
 * Acquires a distributed lock in Firestore using a transaction.
 * Supports lease / stale-lock automatic recovery on expiration.
 */
export async function acquireDistributedSyncLock(
  db: Firestore,
  callerEmail: string,
  ttlMs: number = 30000,
  transactionRunner = defaultRunTransaction,
  docFn = defaultDoc
): Promise<{ acquired: boolean; lockId: string; error?: string }> {
  const lockDocRef = docFn(db, 'system_settings', 'meeting_sync_lock');
  const now = Date.now();
  const lockId = `lock_${now}_${Math.random().toString(36).substring(7)}`;

  try {
    const acquired = await transactionRunner(db, async (transaction) => {
      const lockSnap = await transaction.get(lockDocRef);
      if (lockSnap.exists()) {
        const data = lockSnap.data();
        const expiresAt = data.expiresAt || 0;
        if (data.isLocked && now < expiresAt) {
          return false; // Active lock exists
        }
      }

      transaction.set(lockDocRef, {
        isLocked: true,
        lockId,
        lockedBy: callerEmail,
        lockedAt: now,
        expiresAt: now + ttlMs,
      });
      return true;
    });

    return { acquired, lockId };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error acquiring sync lock:', error);
    return { acquired: false, lockId: '', error: errorMsg };
  }
}

/**
 * Releases the distributed lock in Firestore with ownership validation.
 */
export async function releaseDistributedSyncLock(
  db: Firestore,
  lockId: string,
  transactionRunner = defaultRunTransaction,
  docFn = defaultDoc
): Promise<void> {
  const lockDocRef = docFn(db, 'system_settings', 'meeting_sync_lock');
  try {
    await transactionRunner(db, async (transaction) => {
      const lockSnap = await transaction.get(lockDocRef);
      if (lockSnap.exists()) {
        const data = lockSnap.data();
        if (data.lockId === lockId) {
          transaction.set(lockDocRef, {
            isLocked: false,
            lockId: null,
            lockedBy: null,
            releasedAt: Date.now(),
          });
        }
      }
    });
  } catch (error) {
    console.warn('Error releasing sync lock:', error);
  }
}

/**
 * Executes atomic attendees replacement in a SINGLE Firestore Transaction.
 */
export async function executeAtomicAttendanceReplacement(
  params: AtomicReplacementParams
): Promise<AtomicReplacementResult> {
  const {
    db,
    parsedRows,
    existingAttendees,
    members,
    sourceInfo,
    allowEmptyReplacement = false,
    expectedInitialRevision,
    lockId,
    transactionRunner = defaultRunTransaction,
    docFactory,
  } = params;

  const safeDocFactory =
    docFactory ||
    ((database: Firestore, coll: string, id?: string) => {
      try {
        return id ? defaultDoc(database, coll, id) : defaultDoc(defaultCollection(database, coll));
      } catch {
        return { id: id || `mock_${Math.random()}`, path: `${coll}/${id}` } as DocumentReference<DocumentData>;
      }
    });

  // 1. Zero-Attendee Protection Guard
  if (parsedRows.length === 0 && existingAttendees.length > 0 && !allowEmptyReplacement) {
    return {
      success: false,
      importedCount: 0,
      wokenUpNames: [],
      fingerprint: '',
      newRevision: expectedInitialRevision ?? 0,
      errorCode: 'ZERO_ATTENDEES_PROTECTION',
      errorMessage: '가져온 출석 인원이 0명입니다. 기존 명단을 모두 비우시겠습니까?',
    };
  }

  // 2. Compute planned Firestore operations
  const wokenUpMembers: Member[] = [];
  const wokenUpNames: string[] = [];

  parsedRows.forEach((row) => {
    const member = getMemberFromAttendee(members, row.name, row.studentIdPrefix);
    if (member && member.status === '휴면') {
      if (!wokenUpMembers.some((m) => m.id === member.id)) {
        wokenUpMembers.push(member);
        wokenUpNames.push(member.name);
      }
    }
  });

  const plannedOpsCount =
    existingAttendees.length + // deletes
    parsedRows.length + // inserts
    wokenUpMembers.length + // updates
    (sourceInfo ? 1 : 0) + // metadata
    1 + // revision doc
    (lockId ? 1 : 0); // lock release

  // Firestore single transaction limit guard (hard max 500, safe threshold 450)
  if (plannedOpsCount > 450) {
    return {
      success: false,
      importedCount: 0,
      wokenUpNames: [],
      fingerprint: '',
      newRevision: expectedInitialRevision ?? 0,
      errorCode: 'ATOMIC_BATCH_SIZE_EXCEEDED',
      errorMessage: `계획된 작업 수(${plannedOpsCount}건)가 단일 원자적 트랜잭션 한도(450건)를 초과하여 실행이 중단되었습니다. 기존 명단은 안전하게 보존되었습니다.`,
    };
  }

  // 3. Execute everything inside a SINGLE Firestore Transaction (Full ACID & TOCTOU-Free)
  try {
    let finalFingerprint = '';
    let finalRevision = (expectedInitialRevision ?? 0) + 1;

    await transactionRunner(db, async (transaction) => {
      // 3.1 Lock Ownership Verification
      if (lockId) {
        const lockDocRef = safeDocFactory(db, 'system_settings', 'meeting_sync_lock');
        const lockSnap = await transaction.get(lockDocRef);
        if (lockSnap && typeof lockSnap.exists === 'function' && lockSnap.exists()) {
          const lockData = lockSnap.data() as { isLocked?: boolean; lockId?: string } | undefined;
          if (lockData?.isLocked && lockData?.lockId !== lockId) {
            throw new Error('SYNC_LOCK_LOST');
          }
        }
      }

      // 3.2 Source Identity/Version Verification (TOCTOU Defense on Source)
      if (sourceInfo) {
        const sourceDocRef = safeDocFactory(db, 'system_settings', 'current_meeting_source');
        const sourceSnap = await transaction.get(sourceDocRef);
        if (sourceSnap && typeof sourceSnap.exists === 'function' && sourceSnap.exists()) {
          const currentData = sourceSnap.data() as Partial<CurrentSheetSourceInfo> | undefined;
          if (
            currentData?.spreadsheetId !== sourceInfo.spreadsheetId ||
            currentData?.sheetId !== sourceInfo.sheetId
          ) {
            throw new Error('SOURCE_IDENTITY_CHANGED');
          }
        }
      }

      // 3.3 Mid-Sync Attendee Mutation Protection (Attendance Revision Verification)
      const revDocRef = safeDocFactory(db, 'system_settings', 'attendance_revision');
      if (expectedInitialRevision !== undefined && expectedInitialRevision !== null) {
        const revSnap = await transaction.get(revDocRef);
        if (revSnap && typeof revSnap.exists === 'function' && revSnap.exists()) {
          const revData = revSnap.data() as { revision?: number } | undefined;
          const currentRev = typeof revData?.revision === 'number' ? revData.revision : 0;
          if (currentRev !== expectedInitialRevision) {
            throw new Error('MID_SYNC_ATTENDEE_MUTATION');
          }
          finalRevision = currentRev + 1;
        }
      }

      // 3.4 Delete all existing attendees
      existingAttendees.forEach((a) => {
        transaction.delete(safeDocFactory(db, 'attendees', a.id));
      });

      // 3.5 Insert all new attendees
      const importDate = new Date();
      const importId = `sync_${importDate.getTime()}_${Math.random().toString(36).substring(7)}`;
      const constructedAttendeesForFingerprint: Attendee[] = [];

      parsedRows.forEach((row) => {
        const attendeeRef = safeDocFactory(db, 'attendees', `att_${Date.now()}_${Math.random().toString(36).substring(7)}`);
        const attendeeData = {
          name: row.name,
          studentIdPrefix: row.studentIdPrefix,
          drink: row.drink,
          afterparty: row.afterparty,
          afterpartyPay: row.afterpartyPay,
          request: row.request,
          importDate: Timestamp.fromDate(importDate),
          importId,
          status: '대기' as const,
          source: (sourceInfo?.sourceType || 'manual_sheet') as Attendee['source'],
        };
        transaction.set(attendeeRef, attendeeData);

        constructedAttendeesForFingerprint.push({
          id: attendeeRef.id || 'id',
          ...attendeeData,
          importDate,
        } as unknown as Attendee);
      });

      // 3.6 Wake up dormant members
      wokenUpMembers.forEach((member) => {
        transaction.update(safeDocFactory(db, 'members', member.id), {
          status: '활동',
          dormantSemester: '',
          updatedAt: serverTimestamp(),
        });
      });

      // 3.7 Calculate new fingerprint
      finalFingerprint = calculateAttendeeSetFingerprint(constructedAttendeesForFingerprint);

      // 3.8 Update Source Sync Metadata
      if (sourceInfo) {
        const sourceDocRef = safeDocFactory(db, 'system_settings', 'current_meeting_source');
        transaction.set(
          sourceDocRef,
          {
            ...sourceInfo,
            lastSyncSuccessAt: serverTimestamp(),
            lastSyncAttendeeCount: parsedRows.length,
            lastSyncId: importId,
            lastSyncFingerprint: finalFingerprint,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 3.9 Increment Attendance Revision Document atomically
      transaction.set(
        revDocRef,
        {
          revision: finalRevision,
          fingerprint: finalFingerprint,
          lastUpdatedAt: serverTimestamp(),
          updatedBy: params.callerEmail || null,
        },
        { merge: true }
      );

      // 3.10 Automatically release lock in the same atomic transaction
      if (lockId) {
        const lockDocRef = safeDocFactory(db, 'system_settings', 'meeting_sync_lock');
        transaction.set(
          lockDocRef,
          {
            isLocked: false,
            lockId: null,
            lockedBy: null,
            releasedAt: Date.now(),
          },
          { merge: true }
        );
      }
    });

    return {
      success: true,
      importedCount: parsedRows.length,
      wokenUpNames,
      fingerprint: finalFingerprint,
      newRevision: finalRevision,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '';
    if (errorMsg === 'SOURCE_IDENTITY_CHANGED') {
      return {
        success: false,
        importedCount: 0,
        wokenUpNames: [],
        fingerprint: '',
        newRevision: expectedInitialRevision ?? 0,
        errorCode: 'SOURCE_IDENTITY_CHANGED',
        errorMessage: '동기화 도중 대상 Google Sheet 설정이 변경되었습니다. 이전 데이터를 커밋하지 않고 중단합니다.',
      };
    }
    if (errorMsg === 'MID_SYNC_ATTENDEE_MUTATION') {
      return {
        success: false,
        importedCount: 0,
        wokenUpNames: [],
        fingerprint: '',
        newRevision: expectedInitialRevision ?? 0,
        errorCode: 'MID_SYNC_ATTENDEE_MUTATION',
        errorMessage: '동기화 도중 다른 운영진에 의해 출석 명단이 변경되었습니다. 데이터 충돌 방지를 위해 동기화를 중단합니다.',
      };
    }
    if (errorMsg === 'SYNC_LOCK_LOST') {
      return {
        success: false,
        importedCount: 0,
        wokenUpNames: [],
        fingerprint: '',
        newRevision: expectedInitialRevision ?? 0,
        errorCode: 'SYNC_LOCK_LOST',
        errorMessage: '동기화 락이 만료되었거나 다른 작업에 의해 회수되었습니다. 작업을 중단합니다.',
      };
    }
    return {
      success: false,
      importedCount: 0,
      wokenUpNames: [],
      fingerprint: '',
      newRevision: expectedInitialRevision ?? 0,
      errorCode: 'FIRESTORE_WRITE_FAILED',
      errorMessage: errorMsg || 'Firestore 쓰기 작업에 실패했습니다. 기존 명단은 변경되지 않았습니다.',
    };
  }
}
