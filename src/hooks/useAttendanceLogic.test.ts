import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMoveToRecordBatch } from './useAttendanceLogic';
import { Attendee, Member, SessionGroup } from '../types';
import { Firestore, WriteBatch, Timestamp, doc, setDoc } from 'firebase/firestore';

describe('useAttendanceLogic executeMoveToRecordBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyTimestamp = { toDate: () => new Date() } as unknown as Timestamp;

  const attendees: Attendee[] = [
    {
      id: 'att_1',
      name: '김철수',
      studentIdPrefix: '23',
      drink: '',
      afterparty: false,
      request: '',
      status: '대기',
      importDate: dummyTimestamp,
      importId: 'id_1',
    },
  ];

  const members: Member[] = [
    {
      id: 'm1',
      name: '김철수',
      nickname: '',
      studentId: '20231111',
      phone: '',
      gender: '남',
      semester: '2023-1',
      preferredGenre: [],
      status: '활동',
      createdAt: dummyTimestamp,
    },
  ];

  const groups: SessionGroup[] = [
    { id: 'g1', name: '1조', memberIds: ['att_1'], gameIds: [], targetSize: 4 },
  ];

  it('updates attendee status to 편성됨 and increments attendance_revision in the SAME writeBatch', async () => {
    const mockBatchInstance = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    } as unknown as WriteBatch;

    const mockDoc = vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })) as unknown as typeof doc;
    const mockSetDoc = vi.fn().mockResolvedValue(undefined);

    const res = await executeMoveToRecordBatch(
      {} as Firestore,
      attendees,
      groups,
      members,
      '2026-08-22 정기모임',
      '2026-08-22',
      'admin@avalon.club',
      () => mockBatchInstance,
      mockDoc,
      mockSetDoc as unknown as typeof setDoc
    );

    expect(res.success).toBe(true);

    // 1. Status update in batch
    expect(mockBatchInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendees/att_1' }),
      { status: '편성됨' }
    );

    // 2. Attendance revision increment in the SAME batch
    expect(mockBatchInstance.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'system_settings/attendance_revision' }),
      expect.objectContaining({
        updatedBy: 'admin@avalon.club',
      }),
      { merge: true }
    );

    // 3. Single commit
    expect(mockBatchInstance.commit).toHaveBeenCalledTimes(1);

    // 4. DailyPlannings setDoc
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'DailyPlannings/2026-08-22' }),
      expect.objectContaining({
        name: '2026-08-22 정기모임',
        date: '2026-08-22',
      })
    );
  });

  it('blocks batch and returns error when unregistered members are assigned', async () => {
    const unregisteredAttendees: Attendee[] = [
      {
        id: 'att_unreg',
        name: '미등록인원',
        studentIdPrefix: '99',
        drink: '',
        afterparty: false,
        request: '',
        status: '대기',
        importDate: dummyTimestamp,
        importId: 'id_unreg',
      },
    ];
    const unregGroups: SessionGroup[] = [
      { id: 'g1', name: '1조', memberIds: ['att_unreg'], gameIds: [], targetSize: 4 },
    ];

    const mockBatchInstance = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(),
    } as unknown as WriteBatch;

    const res = await executeMoveToRecordBatch(
      {} as Firestore,
      unregisteredAttendees,
      unregGroups,
      members,
      '2026-08-22 정기모임',
      '2026-08-22',
      'admin@avalon.club',
      () => mockBatchInstance
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('UNREGISTERED_MEMBERS');
    expect(mockBatchInstance.commit).not.toHaveBeenCalled();
  });
});
