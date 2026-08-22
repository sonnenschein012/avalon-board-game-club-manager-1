import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  manualAddAttendeeRecord,
  syncMeetingAttendeesFromSheet,
  importAttendeesFile,
} from './attendeesService';
import { Attendee, Member } from '../types';
import type { Timestamp } from 'firebase/firestore';
import * as googleWorkspaceService from './googleWorkspaceService';
import * as attendancePipeline from './attendancePipeline';

const mockBatchInstance = {
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

// Mock dependencies
vi.mock('../lib/firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { WRITE: 'write', CREATE: 'create', DELETE: 'delete' },
  auth: { currentUser: { email: 'admin@avalon.club' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatchInstance),
  serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
  increment: vi.fn((n) => `INCREMENT_${n}`),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('attendeesService', () => {
  const members: Member[] = [
    {
      id: 'm1',
      name: '김철수',
      nickname: '',
      studentId: '20230001',
      phone: '',
      gender: '남',
      semester: '2023-1',
      preferredGenre: [],
      status: '휴면',
      createdAt: { toDate: () => new Date() } as unknown as Timestamp,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('manualAddAttendeeRecord', () => {
    it('휴면 멤버가 수동 추가될 때 활동 상태로 변경되고 attendance_revision이 증가해야 한다', async () => {
      await manualAddAttendeeRecord(
        {
          name: '김철수',
          studentIdPrefix: '23',
          drink: '콜라',
          afterparty: true,
          request: '',
        },
        members,
        []
      );

      expect(mockBatchInstance.commit).toHaveBeenCalled();
      expect(mockBatchInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'members/m1' }),
        expect.objectContaining({
          status: '활동',
          dormantSemester: '',
        })
      );
      expect(mockBatchInstance.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'system_settings/attendance_revision' }),
        expect.objectContaining({
          revision: 'INCREMENT_1',
          updatedBy: 'admin@avalon.club',
        }),
        { merge: true }
      );
    });
  });

  describe('Assigned Attendees (조편성 진행 상태) Protection Scenarios', () => {
    const assignedAttendee: Attendee = {
      id: 'att_assigned_1',
      name: '김철수',
      studentIdPrefix: '23',
      status: '편성됨',
      drink: '콜라',
      afterparty: true,
      request: '',
      importId: 'id_1',
      importDate: { toDate: () => new Date() } as unknown as Timestamp,
    };

    const unassignedAttendee: Attendee = {
      id: 'att_waiting_1',
      name: '이영희',
      studentIdPrefix: '24',
      status: '대기',
      drink: '',
      afterparty: false,
      request: '',
      importId: 'id_2',
      importDate: { toDate: () => new Date() } as unknown as Timestamp,
    };

    it('1. 편성됨 attendee 없음 -> 추가 경고 없이 진행', async () => {
      vi.spyOn(googleWorkspaceService, 'getCurrentSheetSource').mockResolvedValueOnce({
        sourceType: 'manual_sheet',
        spreadsheetId: 'sheet_123',
        spreadsheetTitle: '출석부',
        sheetId: 0,
        tabTitle: 'Sheet1',
        selectedAt: '2026-08-22',
      });

      vi.spyOn(attendancePipeline, 'acquireDistributedSyncLock').mockResolvedValueOnce({
        acquired: true,
        lockId: 'lock_123',
      });
      vi.spyOn(googleWorkspaceService, 'fetchSheetAttendanceValues').mockResolvedValueOnce({
        spreadsheetId: 'sheet_123',
        sheetId: 0,
        tabTitle: 'Sheet1',
        values: [
          ['이름', '음료', '뒷풀이'],
          ['23 김철수', '콜라', '참석'],
        ],
      });
      vi.spyOn(attendancePipeline, 'executeAtomicAttendanceReplacement').mockResolvedValueOnce({
        success: true,
        importedCount: 1,
        wokenUpNames: [],
        fingerprint: 'fp_1',
        newRevision: 2,
      });

      const onAssignedWarning = vi.fn();

      const res = await syncMeetingAttendeesFromSheet(
        [unassignedAttendee],
        members,
        { onAssignedAttendeesDetected: onAssignedWarning }
      );

      expect(onAssignedWarning).not.toHaveBeenCalled();
      expect(res.success).toBe(true);
    });

    it('2. 편성됨 attendee 존재 + 취소 -> replacement write 미실행 및 안전 중단', async () => {
      vi.spyOn(googleWorkspaceService, 'getCurrentSheetSource').mockResolvedValueOnce({
        sourceType: 'manual_sheet',
        spreadsheetId: 'sheet_123',
        spreadsheetTitle: '출석부',
        sheetId: 0,
        tabTitle: 'Sheet1',
        selectedAt: '2026-08-22',
      });

      const executeReplacementSpy = vi.spyOn(attendancePipeline, 'executeAtomicAttendanceReplacement');

      const onAssignedWarning = vi.fn(() => {
        // User cancels!
      });

      const res = await syncMeetingAttendeesFromSheet(
        [assignedAttendee],
        members,
        { onAssignedAttendeesDetected: onAssignedWarning }
      );

      expect(onAssignedWarning).toHaveBeenCalledTimes(1);
      expect(executeReplacementSpy).not.toHaveBeenCalled();
      expect(res.message).toBe('ASSIGNED_ATTENDEES_CONFIRMATION_REQUIRED');
    });

    it('3. 편성됨 attendee 존재 + 확인 -> replacement 정상 진행', async () => {
      vi.spyOn(googleWorkspaceService, 'getCurrentSheetSource').mockResolvedValueOnce({
        sourceType: 'manual_sheet',
        spreadsheetId: 'sheet_123',
        spreadsheetTitle: '출석부',
        sheetId: 0,
        tabTitle: 'Sheet1',
        selectedAt: '2026-08-22',
      });

      vi.spyOn(attendancePipeline, 'acquireDistributedSyncLock').mockResolvedValueOnce({
        acquired: true,
        lockId: 'lock_123',
      });
      vi.spyOn(googleWorkspaceService, 'fetchSheetAttendanceValues').mockResolvedValueOnce({
        spreadsheetId: 'sheet_123',
        sheetId: 0,
        tabTitle: 'Sheet1',
        values: [
          ['이름', '음료', '뒷풀이'],
          ['23 김철수', '콜라', '참석'],
        ],
      });
      const executeReplacementSpy = vi.spyOn(attendancePipeline, 'executeAtomicAttendanceReplacement').mockResolvedValueOnce({
        success: true,
        importedCount: 1,
        wokenUpNames: [],
        fingerprint: 'fp_1',
        newRevision: 2,
      });

      let proceedFn: (() => Promise<void>) | undefined;
      const onAssignedWarning = vi.fn((proceed: () => Promise<void>) => {
        proceedFn = proceed;
      });

      await syncMeetingAttendeesFromSheet(
        [assignedAttendee],
        members,
        { onAssignedAttendeesDetected: onAssignedWarning }
      );

      expect(onAssignedWarning).toHaveBeenCalledTimes(1);
      if (proceedFn) {
        await proceedFn();
      }
      expect(executeReplacementSpy).toHaveBeenCalledTimes(1);
    });

    it('4. CSV import에서도 편성됨 attendee 존재 시 동일 보호 적용', () => {
      const onAssignedWarning = vi.fn();
      const mockFile = new File(['학번 및 이름,음료\n23 김철수,콜라'], 'attendance.csv', { type: 'text/csv' });

      importAttendeesFile(
        mockFile,
        [assignedAttendee],
        members,
        vi.fn(),
        { onAssignedAttendeesDetected: onAssignedWarning }
      );

      expect(onAssignedWarning).toHaveBeenCalledTimes(1);
    });
  });
});
