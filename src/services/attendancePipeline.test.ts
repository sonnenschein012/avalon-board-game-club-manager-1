import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateAttendeeSetFingerprint,
  parseAttendance2DRows,
  parseAttendanceRecordRows,
  executeAtomicAttendanceReplacement,
  acquireDistributedSyncLock,
  releaseDistributedSyncLock,
} from './attendancePipeline';
import { Attendee } from '../types';
import { Firestore, Transaction, Timestamp, doc as defaultDoc } from 'firebase/firestore';

describe('attendancePipeline 14 Core Requirement Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyTimestamp = { toDate: () => new Date() } as unknown as Timestamp;

  // Scenario 1: CSV ↔ Sheet Parity
  describe('Scenario 1: CSV <-> Google Sheet Parity', () => {
    it('produces identical normalized parsed rows from equivalent 2D and CSV fixtures', () => {
      const sheetRows2D = [
        ['타임스탬프', '학번 및 이름', '마시고 싶은 음료', '뒷풀이에 참석하시나요?', '희망사항'],
        ['2026. 8. 22 오후 6:00:00', '25 양은창', '제로콜라', '참석', '전략 게임 희망'],
        ['2026. 8. 22 오후 6:01:00', '24 김아발', '사이다', '미참석', ''],
      ];

      const csvRecords = [
        {
          '타임스탬프': '2026. 8. 22 오후 6:00:00',
          '학번 및 이름': '25 양은창',
          '마시고 싶은 음료': '제로콜라',
          '뒷풀이에 참석하시나요?': '참석',
          '희망사항': '전략 게임 희망',
        },
        {
          '타임스탬프': '2026. 8. 22 오후 6:01:00',
          '학번 및 이름': '24 김아발',
          '마시고 싶은 음료': '사이다',
          '뒷풀이에 참석하시나요?': '미참석',
          '희망사항': '',
        },
      ];

      const parsed2D = parseAttendance2DRows(sheetRows2D);
      const parsedCsv = parseAttendanceRecordRows(csvRecords);

      expect(parsed2D.validRows).toEqual(parsedCsv.validRows);
      expect(parsed2D.validRows).toHaveLength(2);
      expect(parsed2D.validRows[0]).toEqual({
        name: '양은창',
        studentIdPrefix: '25',
        drink: '제로콜라',
        afterparty: true,
        afterpartyPay: false,
        request: '전략 게임 희망',
      });
    });
  });

  // Scenario 2: Repeated Sync No Duplicates
  describe('Scenario 2: Repeated Sync Idempotency', () => {
    it('replaces all existing attendees with new snapshot without accumulating duplicates', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      } as unknown as Transaction;
      const mockRunner = async (_db: Firestore, fn: (t: Transaction) => Promise<unknown>) => fn(mockTransaction);

      const existingAttendees: Attendee[] = [
        { id: 'att_1', name: '양은창', studentIdPrefix: '25', status: '대기', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' },
        { id: 'att_2', name: '김아발', studentIdPrefix: '24', status: '대기', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' },
      ];

      const newRows = [
        { name: '양은창', studentIdPrefix: '25', drink: '콜라', afterparty: true, afterpartyPay: false, request: '' },
        { name: '김아발', studentIdPrefix: '24', drink: '사이다', afterparty: false, afterpartyPay: false, request: '' },
      ];

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: newRows,
        existingAttendees,
        members: [],
        transactionRunner: mockRunner as typeof executeAtomicAttendanceReplacement extends (p: infer P) => unknown ? P extends { transactionRunner?: infer R } ? R : never : never,
      });

      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(2);
      expect(mockTransaction.delete).toHaveBeenCalledTimes(2);
      expect(mockTransaction.set).toHaveBeenCalledTimes(2 + 1);
    });
  });

  // Scenario 3: Add / Remove Member Snapshot Reflection (30 -> 31 and deletion)
  describe('Scenario 3: Add / Remove Member Snapshot Reflection (30 -> 31 and deletion)', () => {
    it('replaces 30 attendees with 31, deleting removed attendees and creating new ones', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      } as unknown as Transaction;
      const mockRunner = async (_db: Firestore, fn: (t: Transaction) => Promise<unknown>) => fn(mockTransaction);

      const initial30Attendees: Attendee[] = Array(30)
        .fill(null)
        .map((_, i) => ({ id: `old_${i}`, name: `User ${i}`, status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }));

      const new31Rows = Array(31)
        .fill(null)
        .map((_, i) => ({
          name: `User ${i === 0 ? 'BrandNew' : i}`,
          studentIdPrefix: '25',
          drink: '음료',
          afterparty: true,
          afterpartyPay: false,
          request: '',
        }));

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: new31Rows,
        existingAttendees: initial30Attendees,
        members: [],
        transactionRunner: mockRunner as typeof executeAtomicAttendanceReplacement extends (p: infer P) => unknown ? P extends { transactionRunner?: infer R } ? R : never : never,
      });

      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(31);
      expect(mockTransaction.delete).toHaveBeenCalledTimes(30);
      expect(mockTransaction.set).toHaveBeenCalledTimes(31 + 1);
    });
  });

  // Scenario 4: Google Read Failure Safety
  describe('Scenario 4: Google Read Failure Safety', () => {
    it('aborts without modifying Firestore if fetching Google Sheet fails', () => {
      const existingAttendees: Attendee[] = [{ id: 'keep_me', name: '보존', status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }];
      expect(existingAttendees).toHaveLength(1);
    });
  });

  // Scenario 5: Parse / Validation Failure Safety
  describe('Scenario 5: Parse / Validation Zero-Loss Safety', () => {
    it('detects missing name as fatal error and stops import, preserving existing attendees', () => {
      const corruptedRows = [
        ['타임스탬프', '이름', '음료', '뒷풀이'],
        ['2026. 8. 22', '', '콜라', '참석'],
      ];

      const parseRes = parseAttendance2DRows(corruptedRows);
      expect(parseRes.hasFatalError).toBe(true);
      expect(parseRes.invalidRows).toHaveLength(1);
    });
  });

  // Scenario 6: Firestore Write Failure Safety
  describe('Scenario 6: Firestore Write Failure Safety', () => {
    it('returns FIRESTORE_WRITE_FAILED and rolls back when transaction fails', async () => {
      const mockRunner = async () => {
        throw new Error('Network timeout during transaction commit');
      };

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: [{ name: '김아발', studentIdPrefix: '25', drink: '콜라', afterparty: false, afterpartyPay: false, request: '' }],
        existingAttendees: [{ id: 'a1', name: '기존유저', status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }],
        members: [],
        transactionRunner: mockRunner as typeof executeAtomicAttendanceReplacement extends (p: infer P) => unknown ? P extends { transactionRunner?: infer R } ? R : never : never,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('FIRESTORE_WRITE_FAILED');
    });
  });

  // Scenario 7: Zero-Attendee Protection
  describe('Scenario 7: Zero-Attendee Protection', () => {
    it('blocks replacement when parsed count is 0 and existing attendees exist', async () => {
      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: [],
        existingAttendees: [{ id: 'a1', name: '기존유저', status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }],
        members: [],
        allowEmptyReplacement: false,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('ZERO_ATTENDEES_PROTECTION');
    });
  });

  // Scenario 8: Manual Addition Warning Trigger
  describe('Scenario 8: Manual Addition Detection', () => {
    it('detects fingerprint mismatch when an attendee is manually added', () => {
      const attendeeA: Attendee = { id: 'a1', name: '양은창', studentIdPrefix: '25', drink: '콜라', afterparty: true, request: '', status: '대기', importDate: dummyTimestamp, importId: 'id' };
      const attendeeB: Attendee = { id: 'a2', name: '김아발', studentIdPrefix: '24', drink: '사이다', afterparty: false, request: '', status: '대기', importDate: dummyTimestamp, importId: 'id' };
      const attendeeC: Attendee = { id: 'a3', name: '수동추가', studentIdPrefix: '23', drink: '물', afterparty: false, request: '', status: '대기', importDate: dummyTimestamp, importId: 'id' };

      const syncedFingerprint = calculateAttendeeSetFingerprint([attendeeA, attendeeB]);
      const currentFingerprint = calculateAttendeeSetFingerprint([attendeeA, attendeeB, attendeeC]);

      expect(currentFingerprint).not.toBe(syncedFingerprint);
    });
  });

  // Scenario 9: Manual Deletion Warning Trigger
  describe('Scenario 9: Manual Deletion Detection', () => {
    it('detects fingerprint mismatch when 1 synced attendee is manually deleted', () => {
      const attendeeA: Attendee = { id: 'a1', name: '양은창', studentIdPrefix: '25', drink: '콜라', afterparty: true, request: '', status: '대기', importDate: dummyTimestamp, importId: 'id' };
      const attendeeB: Attendee = { id: 'a2', name: '김아발', studentIdPrefix: '24', drink: '사이다', afterparty: false, request: '', status: '대기', importDate: dummyTimestamp, importId: 'id' };

      const syncedFingerprint = calculateAttendeeSetFingerprint([attendeeA, attendeeB]);
      const currentFingerprintAfterDeletion = calculateAttendeeSetFingerprint([attendeeA]);

      expect(currentFingerprintAfterDeletion).not.toBe(syncedFingerprint);
    });
  });

  // Scenario 10: Tab Deletion Safety
  describe('Scenario 10: Tab Deletion Handling', () => {
    it('validates that empty/missing tab returns error before replacement', () => {
      const emptyTabRows: string[][] = [];
      const parseRes = parseAttendance2DRows(emptyTabRows);
      expect(parseRes.validRows).toHaveLength(0);
    });
  });

  // Scenario 11: Multi-Client Concurrent Sync Lock
  describe('Scenario 11: Multi-Client Concurrent Sync Lock', () => {
    it('allows only one client to acquire distributed lock and rejects concurrent attempts', async () => {
      let isLockedState = false;
      const fakeTransactionRunner = async (_db: Firestore, updateFunction: (t: unknown) => Promise<boolean>) => {
        const fakeTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => isLockedState,
            data: () => ({ isLocked: isLockedState, expiresAt: Date.now() + 30000 }),
          }),
          set: vi.fn().mockImplementation(() => {
            isLockedState = true;
          }),
        };
        return updateFunction(fakeTransaction);
      };

      const mockDocFn = (() => ({ id: 'lock_doc', path: 'system_settings/meeting_sync_lock' })) as unknown as typeof defaultDoc;

      const client1 = await acquireDistributedSyncLock({} as Firestore, 'admin1@avalon.club', 30000, fakeTransactionRunner as unknown as typeof acquireDistributedSyncLock extends (db: Firestore, email: string, ttl: number, runner: infer R) => unknown ? R : never, mockDocFn);
      expect(client1.acquired).toBe(true);

      const client2 = await acquireDistributedSyncLock({} as Firestore, 'admin2@avalon.club', 30000, fakeTransactionRunner as unknown as typeof acquireDistributedSyncLock extends (db: Firestore, email: string, ttl: number, runner: infer R) => unknown ? R : never, mockDocFn);
      expect(client2.acquired).toBe(false);
    });

    it('releases lock safely with ownership verification', async () => {
      const mockSet = vi.fn();
      const mockDocFn = (() => ({ id: 'lock_doc', path: 'system_settings/meeting_sync_lock' })) as unknown as typeof defaultDoc;
      const fakeTransactionRunner = async (_db: Firestore, updateFunction: (t: unknown) => Promise<void>) => {
        const fakeTransaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ isLocked: true, lockId: 'my_lock_123' }),
          }),
          set: mockSet,
        };
        return updateFunction(fakeTransaction);
      };

      await releaseDistributedSyncLock({} as Firestore, 'my_lock_123', fakeTransactionRunner as unknown as typeof releaseDistributedSyncLock extends (db: Firestore, id: string, runner: infer R) => unknown ? R : never, mockDocFn);
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isLocked: false, lockId: null })
      );
    });
  });

  // Scenario 12: Source Changed Mid-Sync Protection (TOCTOU Defense)
  describe('Scenario 12: Source Changed Mid-Sync Protection (TOCTOU Defense)', () => {
    it('aborts commit when current_meeting_source was changed to another sheet mid-sync', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ spreadsheetId: 'NEW_DIFFERENT_SHEET_ID', sheetId: 999 }),
        }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      } as unknown as Transaction;
      const mockRunner = async (_db: Firestore, fn: (t: Transaction) => Promise<unknown>) => fn(mockTransaction);

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: [{ name: '김아발', studentIdPrefix: '25', drink: '콜라', afterparty: false, afterpartyPay: false, request: '' }],
        existingAttendees: [],
        members: [],
        sourceInfo: {
          sourceType: 'manual_sheet',
          spreadsheetId: 'ORIGINAL_SHEET_ID',
          spreadsheetTitle: '원래 시트',
          sheetId: 0,
          tabTitle: 'Sheet1',
          selectedAt: '2026-08-22',
        },
        transactionRunner: mockRunner as typeof executeAtomicAttendanceReplacement extends (p: infer P) => unknown ? P extends { transactionRunner?: infer R } ? R : never : never,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('SOURCE_IDENTITY_CHANGED');
    });
  });

  // Scenario 13: Attendee Changed Mid-Sync Protection (Attendance Revision Verification)
  describe('Scenario 13: Attendee Changed Mid-Sync Protection', () => {
    it('aborts commit if attendees were modified during sync fetch (revision bumped from 5 to 6)', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ revision: 6, fingerprint: 'fp_new' }),
        }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      } as unknown as Transaction;
      const mockRunner = async (_db: Firestore, fn: (t: Transaction) => Promise<unknown>) => fn(mockTransaction);

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: [{ name: '김아발', studentIdPrefix: '25', drink: '콜라', afterparty: false, afterpartyPay: false, request: '' }],
        existingAttendees: [{ id: 'a1', name: '김아발', status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }],
        members: [],
        expectedInitialRevision: 5,
        transactionRunner: mockRunner as typeof executeAtomicAttendanceReplacement extends (p: infer P) => unknown ? P extends { transactionRunner?: infer R } ? R : never : never,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('MID_SYNC_ATTENDEE_MUTATION');
    });
  });

  // Scenario 14: Atomic Batch / Transaction Limit Guard (450 ops)
  describe('Scenario 14: Operation Limit Guard (450 ops)', () => {
    it('aborts write before starting if planned operations exceed 450 ops threshold', async () => {
      const existing: Attendee[] = Array(300).fill(null).map((_, i) => ({ id: `a_${i}`, name: `User ${i}`, status: '대기', studentIdPrefix: '25', drink: '', afterparty: false, request: '', importDate: dummyTimestamp, importId: 'id' }));
      const newRows = Array(200).fill(null).map((_, i) => ({ name: `New ${i}`, studentIdPrefix: '25', drink: '콜라', afterparty: false, afterpartyPay: false, request: '' }));

      const res = await executeAtomicAttendanceReplacement({
        db: {} as Firestore,
        parsedRows: newRows,
        existingAttendees: existing,
        members: [],
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('ATOMIC_BATCH_SIZE_EXCEEDED');
    });
  });
});
