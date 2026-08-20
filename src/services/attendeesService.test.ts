import { describe, it, expect, vi, beforeEach } from 'vitest';
import { manualAddAttendeeRecord } from './attendeesService';
import { Member } from '../types';
import type { Timestamp } from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../lib/firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { WRITE: 'write' }
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: { fromDate: vi.fn() }
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
    expect(setDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
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
    expect(setDoc).not.toHaveBeenCalled();
  });
});
