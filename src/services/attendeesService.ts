import { writeBatch, doc, collection, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Attendee, Member } from '../types';
import { CurrentSheetSourceInfo } from '../types/googleWorkspace';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { isSameName } from '../domain/matching/isSameName';
import {
  parseAttendanceRecordRows,
  parseAttendance2DRows,
  executeAtomicAttendanceReplacement,
  calculateAttendeeSetFingerprint,
  acquireDistributedSyncLock,
  releaseDistributedSyncLock,
  getCurrentAttendanceRevision,
  ParsedAttendeeRow,
} from './attendancePipeline';
import { fetchSheetAttendanceValues, getCurrentSheetSource } from './googleWorkspaceService';

export async function deleteAttendeeRecord(attendeeToDelete: Attendee) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'attendees', attendeeToDelete.id));

    // Update revision doc
    const revRef = doc(db, 'system_settings', 'attendance_revision');
    batch.set(
      revRef,
      {
        revision: increment(1),
        lastUpdatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin',
      },
      { merge: true }
    );

    await batch.commit();
    toast.success(`${attendeeToDelete.name}님이 출석 명단에서 삭제되었습니다.`);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, 'attendees');
    toast.error('삭제 중 오류가 발생했습니다.');
    return false;
  }
}

export async function quickAddMemberRecord(attendee: Attendee) {
  try {
    const batch = writeBatch(db);
    const memberRef = doc(collection(db, 'members'));

    const studentId = attendee.studentIdPrefix || '25';
    const nickname = `${studentId} ${attendee.name}`;

    batch.set(memberRef, {
      name: attendee.name,
      nickname: nickname,
      studentId: studentId,
      gender: '남',
      semester: '2025-1',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    toast.success(`${attendee.name}님이 멤버로 추가되었습니다.`);
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'members (batch)');
    toast.error('추가 중 오류가 발생했습니다.');
    return false;
  }
}

export async function manualAddAttendeeRecord(
  data: { name: string; studentIdPrefix: string; drink: string; afterparty: boolean; request: string },
  members: Member[],
  attendees: Attendee[]
) {
  const { name, studentIdPrefix, drink, afterparty, request } = data;
  if (!name) return false;

  try {
    let matchedMembers = members.filter((m) => isSameName(m.name, name));
    if (studentIdPrefix) {
      matchedMembers = matchedMembers.filter((m) => {
        const mPrefix = m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find((x) => x) || '';
        return mPrefix === studentIdPrefix || m.studentId?.startsWith(studentIdPrefix);
      });
    }

    if (matchedMembers.length === 0) {
      toast.error('명부에 해당 이름과 학번을 가진 동아리원이 없습니다.');
      return false;
    }

    const member = matchedMembers[0];
    if (!member) {
      toast.error('명부에 해당 이름과 학번을 가진 동아리원이 없습니다.');
      return false;
    }
    const actualStudentIdPrefix =
      member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find((x) => x) || studentIdPrefix;

    const isAlreadyInAttendees = attendees.some(
      (a) => isSameName(a.name, member.name) && (a.studentIdPrefix === actualStudentIdPrefix || !actualStudentIdPrefix)
    );

    if (isAlreadyInAttendees) {
      toast.error('이미 출석 명단에 있는 동아리원입니다.');
      return false;
    }

    const batch = writeBatch(db);
    const docRef = doc(collection(db, 'attendees'));
    const importDate = new Date();
    const importId = Math.random().toString(36).substring(7);

    const newAttendeeData = {
      name: member.name,
      studentIdPrefix: actualStudentIdPrefix,
      drink,
      afterparty,
      request,
      importDate: Timestamp.fromDate(importDate),
      importId,
      status: '대기' as const,
      source: 'manual_add' as const,
    };

    batch.set(docRef, newAttendeeData);

    if (member && member.status === '휴면') {
      batch.update(doc(db, 'members', member.id), { status: '활동', dormantSemester: '' });
    }

    // Atomically bump attendance revision
    const revRef = doc(db, 'system_settings', 'attendance_revision');
    batch.set(
      revRef,
      {
        revision: increment(1),
        lastUpdatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin',
      },
      { merge: true }
    );

    await batch.commit();

    if (member && member.status === '휴면') {
      toast.success(`휴면 멤버 ${member.name}님이 출석하여 활동 상태로 자동 전환되었습니다.`);
    } else {
      toast.success(`${name}님이 출석 명단에 추가되었습니다.`);
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'attendees');
    toast.error('명단 추가 중 오류가 발생했습니다.');
    return false;
  }
}

export interface ImportAttendeesOptions {
  onAssignedAttendeesDetected?: (proceed: () => void) => void;
}

/**
 * Imports attendees from a CSV file using the unified Atomic Attendance Pipeline.
 * Enforces Assigned Attendees (조편성 진행 상태) protection.
 */
export function importAttendeesFile(
  file: File,
  attendees: Attendee[],
  members: Member[],
  onComplete: () => void,
  options?: ImportAttendeesOptions
): void {
  const hasAssignedAttendees = attendees.some((a) => a.status === '편성됨');

  const executeImport = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: Papa.ParseResult<Record<string, string>>) => {
        try {
          const parseResult = parseAttendanceRecordRows(results.data);

          if (parseResult.hasFatalError) {
            toast.error(
              `CSV 데이터에 오류가 있습니다: ${parseResult.invalidRows[0]?.reason} (${parseResult.invalidRows[0]?.rowIndex}번째 행). 기존 명단이 안전하게 유지되었습니다.`
            );
            onComplete();
            return;
          }

          const revInfo = await getCurrentAttendanceRevision(db);

          const replacementResult = await executeAtomicAttendanceReplacement({
            db,
            parsedRows: parseResult.validRows,
            existingAttendees: attendees,
            members,
            sourceInfo: null,
            expectedInitialRevision: revInfo.revision,
            callerEmail: auth.currentUser?.email || 'admin',
          });

          if (!replacementResult.success) {
            toast.error(replacementResult.errorMessage || '명단 교체에 실패했습니다.');
            onComplete();
            return;
          }

          toast.success(`이전 목록이 안전하게 교체되고 ${replacementResult.importedCount}명의 명단이 새로 등록되었습니다.`);

          if (replacementResult.wokenUpNames.length > 0) {
            const uniqueWokenUp = Array.from(new Set(replacementResult.wokenUpNames));
            uniqueWokenUp.forEach((wokenName) => {
              toast.success(`휴면 멤버 ${wokenName}님이 출석하여 활동 상태로 자동 전환되었습니다.`);
            });
          }
          onComplete();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'attendees (batch)');
          toast.error('임포트 중 오류가 발생했습니다.');
          onComplete();
        }
      },
    });
  };

  if (hasAssignedAttendees) {
    if (options?.onAssignedAttendeesDetected) {
      options.onAssignedAttendeesDetected(executeImport);
    } else {
      const confirmed = window.confirm(
        '이미 조편성이 진행된 상태입니다. 다시 불러오면 현재 조편성 상태가 초기화됩니다. 계속 진행하시겠습니까?'
      );
      if (confirmed) {
        executeImport();
      } else {
        onComplete();
      }
    }
  } else {
    executeImport();
  }
}

export interface SyncSheetAttendeesOptions {
  onManualModificationDetected?: (proceed: () => Promise<void>) => void;
  onZeroAttendeesDetected?: (proceed: () => Promise<void>) => void;
  onAssignedAttendeesDetected?: (proceed: () => Promise<void>) => void;
  allowEmptyReplacement?: boolean;
}

/**
 * Synchronizes attendance list from the currently configured Google Sheet source.
 * Enforces distributed lock, Zero-Loss parsing, assigned attendees protection, manual modification tracking, and atomic single-transaction replacement.
 */
export async function syncMeetingAttendeesFromSheet(
  attendees: Attendee[],
  members: Member[],
  options?: SyncSheetAttendeesOptions
): Promise<{ success: boolean; importedCount: number; message?: string }> {
  const callerEmail = auth.currentUser?.email || 'admin';

  // 1. Check if attendees are already assigned in groups (조편성 진행 상태 보호)
  const hasAssignedAttendees = attendees.some((a) => a.status === '편성됨');
  if (hasAssignedAttendees) {
    if (options?.onAssignedAttendeesDetected) {
      options.onAssignedAttendeesDetected(async () => {
        await doSyncMeetingAttendeesFromSheet(attendees, members, options, callerEmail);
      });
      return { success: false, importedCount: 0, message: 'ASSIGNED_ATTENDEES_CONFIRMATION_REQUIRED' };
    } else {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('이미 조편성이 진행된 상태입니다. 다시 불러오면 현재 조편성 상태가 초기화됩니다. 계속 진행하시겠습니까?')
        : true;
      if (!confirmed) {
        return { success: false, importedCount: 0, message: 'USER_CANCELLED_ASSIGNED_OVERWRITE' };
      }
    }
  }

  return doSyncMeetingAttendeesFromSheet(attendees, members, options, callerEmail);
}

async function doSyncMeetingAttendeesFromSheet(
  attendees: Attendee[],
  members: Member[],
  options: SyncSheetAttendeesOptions | undefined,
  callerEmail: string
): Promise<{ success: boolean; importedCount: number; message?: string }> {
  // 1. Fetch current meeting source configuration
  const source = await getCurrentSheetSource();
  if (!source || !source.spreadsheetId) {
    toast.error('연결된 Google Sheet 출석부 설정이 없습니다. 먼저 Sheet를 선택해주세요.');
    return { success: false, importedCount: 0, message: 'NO_SOURCE_CONFIGURED' };
  }

  // 2. Fetch current attendance revision before starting
  const initialRevInfo = await getCurrentAttendanceRevision(db);

  // 3. Acquire distributed concurrency lock in Firestore
  const lock = await acquireDistributedSyncLock(db, callerEmail);
  if (!lock.acquired) {
    toast.error('다른 운영진 또는 작업에서 출석 동기화가 진행 중입니다. 잠시 후 다시 시도해주세요.');
    return { success: false, importedCount: 0, message: 'CONCURRENT_SYNC_BLOCKED' };
  }

  try {
    // 4. Fetch 2D rows from Google Sheets API by stable sheetId
    const sheetData = await fetchSheetAttendanceValues(source.spreadsheetId, source.sheetId);

    // 5. Parse & Validate 2D rows (Zero-Loss Principle)
    const parseResult = parseAttendance2DRows(sheetData.values);
    if (parseResult.hasFatalError) {
      toast.error(
        `Google Sheet 데이터에 확인이 필요한 오류가 있습니다: ${parseResult.invalidRows[0]?.reason} (${parseResult.invalidRows[0]?.rowIndex}번째 행). 기존 명단이 안전하게 유지되었습니다.`
      );
      await releaseDistributedSyncLock(db, lock.lockId);
      return { success: false, importedCount: 0, message: 'INVALID_ATTENDEE_DATA' };
    }

    // 6. Zero-Attendee Protection Guard
    if (parseResult.validRows.length === 0 && attendees.length > 0 && !options?.allowEmptyReplacement) {
      if (options?.onZeroAttendeesDetected) {
        options.onZeroAttendeesDetected(async () => {
          await executeSyncReplacement(parseResult.validRows, attendees, members, source, true, initialRevInfo.revision, lock.lockId);
          await releaseDistributedSyncLock(db, lock.lockId);
        });
        return { success: false, importedCount: 0, message: 'ZERO_ATTENDEES_CONFIRMATION_REQUIRED' };
      } else {
        toast.error('가져온 출석 인원이 0명입니다. 기존 명단 보호를 위해 동기화가 중단되었습니다.');
        await releaseDistributedSyncLock(db, lock.lockId);
        return { success: false, importedCount: 0, message: 'ZERO_ATTENDEES_PROTECTION' };
      }
    }

    // 7. Manual Modification Detection using deterministic fingerprint
    const currentFingerprint = calculateAttendeeSetFingerprint(attendees);
    const lastSyncFingerprint = (source as CurrentSheetSourceInfo & { lastSyncFingerprint?: string }).lastSyncFingerprint;
    const hasManualModifications =
      lastSyncFingerprint &&
      currentFingerprint !== 'EMPTY_SET' &&
      currentFingerprint !== lastSyncFingerprint;

    if (hasManualModifications && options?.onManualModificationDetected) {
      options.onManualModificationDetected(async () => {
        await executeSyncReplacement(parseResult.validRows, attendees, members, source, false, initialRevInfo.revision, lock.lockId);
        await releaseDistributedSyncLock(db, lock.lockId);
      });
      return { success: false, importedCount: 0, message: 'MANUAL_MODIFICATION_CONFIRMATION_REQUIRED' };
    }

    // 8. Execute Atomic Single Transaction Replacement
    const res = await executeSyncReplacement(
      parseResult.validRows,
      attendees,
      members,
      source,
      options?.allowEmptyReplacement ?? false,
      initialRevInfo.revision,
      lock.lockId
    );

    return res;
  } catch (error: unknown) {
    await releaseDistributedSyncLock(db, lock.lockId);
    handleFirestoreError(error, OperationType.WRITE, 'attendees (sync)');
    const errorMsg = error instanceof Error ? error.message : 'Google Sheet 동기화 중 오류가 발생했습니다.';
    toast.error(errorMsg);
    return { success: false, importedCount: 0, message: errorMsg || 'SYNC_ERROR' };
  }
}

async function executeSyncReplacement(
  validRows: ParsedAttendeeRow[],
  attendees: Attendee[],
  members: Member[],
  source: CurrentSheetSourceInfo,
  allowEmptyReplacement: boolean,
  expectedInitialRevision?: number,
  lockId?: string
): Promise<{ success: boolean; importedCount: number; message?: string }> {
  const replacementResult = await executeAtomicAttendanceReplacement({
    db,
    parsedRows: validRows,
    existingAttendees: attendees,
    members,
    sourceInfo: source,
    allowEmptyReplacement,
    expectedInitialRevision,
    lockId,
    callerEmail: auth.currentUser?.email || 'admin',
  });

  if (!replacementResult.success) {
    toast.error(replacementResult.errorMessage || '출석 명단 원자적 교체에 실패했습니다.');
    return { success: false, importedCount: 0, message: replacementResult.errorCode || 'REPLACEMENT_FAILED' };
  }

  toast.success(
    `Google Sheet와 동기화 완료: ${replacementResult.importedCount}명의 출석 명단이 새로 등록되었습니다.`
  );

  if (replacementResult.wokenUpNames.length > 0) {
    const uniqueWokenUp = Array.from(new Set(replacementResult.wokenUpNames));
    uniqueWokenUp.forEach((wokenName) => {
      toast.success(`휴면 멤버 ${wokenName}님이 출석하여 활동 상태로 자동 전환되었습니다.`);
    });
  }

  return { success: true, importedCount: replacementResult.importedCount };
}

export async function clearAllAttendees(attendees: Attendee[]) {
  try {
    const batch = writeBatch(db);
    attendees.forEach((a) => batch.delete(doc(db, 'attendees', a.id)));

    const revRef = doc(db, 'system_settings', 'attendance_revision');
    batch.set(
      revRef,
      {
        revision: increment(1),
        lastUpdatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin',
      },
      { merge: true }
    );

    await batch.commit();
    toast.success('모든 대기 기록이 초기화되었습니다.');
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'attendees (batch)');
    toast.error('오류가 발생했습니다.');
    return false;
  }
}
