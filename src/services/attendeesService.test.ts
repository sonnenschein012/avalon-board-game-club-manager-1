import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importAttendanceRows, manualAddAttendeeRecord } from './attendeesService';
import { Member, type Attendee } from '../types';
import { detectAttendanceMapping } from '../domain/attendance/csvParser';
import type { Timestamp } from 'firebase/firestore';

const batch = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
const addAuditEventToBatch = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('../lib/firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { WRITE: 'write' }
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  writeBatch: vi.fn(() => batch),
  serverTimestamp: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: { fromDate: vi.fn() }
}));

vi.mock('./auditService', () => ({
  addAuditEventToBatch,
  createAuditEventOperation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('attendeesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const members: Member[] = [
    { id: 'm1', name: '김철수', studentId: '20231111', gender: '남', semester: '2023-1', nickname: '', phone: '', preferredGenre: [], createdAt: { toMillis: () => 0 } as unknown as Timestamp }
  ];

  it('명부와 일치하는 회원을 실제 출석 문서 형태로 저장한다', async () => {
    const result = await manualAddAttendeeRecord(
      { name: '김철수', studentIdPrefix: '23', drink: '', afterparty: false, request: '' },
      members,
      []
    );
    expect(result).toBe(true);
    expect(batch.set).toHaveBeenCalledWith(undefined, expect.objectContaining({
      name: '김철수',
      studentIdPrefix: '23',
      status: '대기',
    }));
  });

  it('변환 실패 시 원본 ID 유지 (매칭 실패)', async () => {
    // If name doesn't match members, manualAddAttendeeRecord should show a toast and return false
    const toast = await import('sonner');
    const result = await manualAddAttendeeRecord(
      { name: '홍길동', studentIdPrefix: '22', drink: '', afterparty: false, request: '' },
      members,
      []
    );
    expect(result).toBe(false);
    expect(toast.toast.error).toHaveBeenCalledWith('명부에 해당 이름과 학번을 가진 동아리원이 없습니다.');
  });

  it('같은 회원이 이미 출석 명단에 있으면 중복 저장하지 않는다', async () => {
    const result = await manualAddAttendeeRecord(
      { name: '김철수', studentIdPrefix: '23', drink: '', afterparty: false, request: '' },
      members,
      [{ id: 'a1', name: '김철수', studentIdPrefix: '23' } as never],
    );
    expect(result).toBe(false);
    expect(batch.set).not.toHaveBeenCalled();
  });
  const headers = ['학번 및 이름', '주문할 음료', '뒤풀이에 참석하시나요?', '희망사항'];
  const draft = (rows = [['23 김철수', '차', '네', '']]) => ({ headers, rows, mapping: detectAttendanceMapping(headers) });
  it('revalidates before any deletion and refuses an empty or invalid replacement', async () => {
    const existing = [{ id: 'old' }] as Attendee[];
    expect(await importAttendanceRows(draft([]), existing, members)).toBe(false);
    expect(await importAttendanceRows(draft([['23 김철수', '차', '아마도', '']]), existing, members)).toBe(false);
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
  it('commits the replacement, normalized responses, dormant updates and audit together', async () => {
    expect(await importAttendanceRows(draft(), [{ id: 'old' }] as Attendee[], [{ ...members[0]!, status: '휴면' }])).toBe(true);
    expect(batch.delete).toHaveBeenCalledOnce();
    expect(batch.set).toHaveBeenCalledWith(undefined, expect.objectContaining({ name: '김철수', drink: '차', afterparty: true, request: '', status: '대기' }));
    expect(batch.update).toHaveBeenCalledWith(undefined, { status: '활동', dormantSemester: '' });
    expect(addAuditEventToBatch).toHaveBeenCalledWith(batch, expect.objectContaining({ action: 'attendance.imported', count: 1 }));
    expect(batch.commit).toHaveBeenCalledOnce();
  });
  it('reports failed atomic commits and refuses to split an oversized replacement', async () => {
    batch.commit.mockRejectedValueOnce(new Error('offline'));
    expect(await importAttendanceRows(draft(), [], members)).toBe(false);
    vi.clearAllMocks();
    expect(await importAttendanceRows(draft(), Array.from({ length: 500 }, (_, index) => ({ id: String(index) })) as Attendee[], members)).toBe(false);
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
