import { writeBatch, doc, collection, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Attendee, Member } from '../types';
import { toast } from 'sonner';
import { isSameName } from '../domain/matching/isSameName';
import { previewAttendanceCsv, type AttendanceImportInput } from '../domain/attendance/csvParser';
import { addAuditEventToBatch } from './auditService';

export async function deleteAttendeeRecord(attendeeToDelete: Attendee) {
  try {
    await deleteDoc(doc(db, 'attendees', attendeeToDelete.id));
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
      createdAt: serverTimestamp()
    });
    addAuditEventToBatch(batch, {
      category: 'member',
      action: 'member.created_from_attendance',
      targetId: memberRef.id,
      targetLabel: attendee.name,
      detail: `출석 명단에서 빠른 등록 · 학번 ${studentId}`,
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
    let matchedMembers = members.filter(m => isSameName(m.name, name));
    if (studentIdPrefix) {
      matchedMembers = matchedMembers.filter(m => {
        const mPrefix = m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || '';
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
    const actualStudentIdPrefix = member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || studentIdPrefix;

    const isAlreadyInAttendees = attendees.some(a => isSameName(a.name, member.name) && (a.studentIdPrefix === actualStudentIdPrefix || !actualStudentIdPrefix));

    if (isAlreadyInAttendees) {
      toast.error('이미 출석 명단에 있는 동아리원입니다.');
      return false;
    }

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
      status: '대기' as const
    };

    const batch = writeBatch(db);
    batch.set(docRef, newAttendeeData);
    if (member && member.status === '휴면') {
      batch.update(doc(db, 'members', member.id), { status: '활동', dormantSemester: '' });
      addAuditEventToBatch(batch, {
        category: 'member',
        action: 'member.bulk_active',
        targetId: member.id,
        targetLabel: member.name,
        changes: [
          { field: 'status', label: '활동 상태', before: '휴면', after: '활동' },
          { field: 'dormantSemester', label: '휴면 학기', before: member.dormantSemester || '없음', after: '없음' },
        ],
        detail: '출석 명단에 추가되어 자동으로 활동 상태로 복원했습니다.',
      });
    }
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

export async function importAttendanceRows(
  input: AttendanceImportInput,
  attendees: Attendee[],
  members: Member[],
): Promise<boolean> {
  const preview = previewAttendanceCsv(input, members);
  if (!preview.canImport) {
    toast.error('열 연결과 오류 행을 확인해주세요. 기존 명단은 유지됩니다.');
    return false;
  }
  const wakingMembers = members.filter(member => member.status === '휴면'
    && preview.rows.some(row => row.memberId === member.id));
  // One commit prevents a failed import from deleting only part of the roster.
  if (attendees.length + preview.rows.length + wakingMembers.length + 1 > 500) {
    toast.error('한 번에 교체할 수 있는 명단 크기를 초과했습니다. 기존 명단은 유지됩니다.');
    return false;
  }
  try {
    const batch = writeBatch(db);
    const importDate = Timestamp.fromDate(new Date());
    const importId = crypto.randomUUID();
    attendees.forEach(attendee => batch.delete(doc(db, 'attendees', attendee.id)));
    preview.rows.forEach(row => batch.set(doc(collection(db, 'attendees')), {
      ...row.data, importDate, importId, status: '대기',
    }));
    wakingMembers.forEach(member => batch.update(doc(db, 'members', member.id), {
      status: '활동', dormantSemester: '',
    }));
    addAuditEventToBatch(batch, {
      category: 'attendance', action: 'attendance.imported',
      targetLabel: `출석 명단 ${preview.rows.length}명`, count: preview.rows.length,
      detail: `기존 ${attendees.length}명 교체 · 음료 ${preview.counts.drinks}명 · 뒤풀이 참석 ${preview.counts.attending}명${wakingMembers.length ? ` · 휴면 해제 ${wakingMembers.map(member => member.name).join(', ')}` : ''}`,
    });
    await batch.commit();
    toast.success(`${preview.rows.length}명의 명단을 반영했습니다.${wakingMembers.length ? ` 휴면 부원 ${wakingMembers.length}명이 활동 상태로 전환되었습니다.` : ''}`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'attendees (batch)');
    toast.error('명단을 반영하지 못했습니다. 다시 시도해주세요.');
    return false;
  }
}

export async function clearAllAttendees(attendees: Attendee[]) {
  try {
    const batch = writeBatch(db);
    attendees.forEach(a => batch.delete(doc(db, 'attendees', a.id)));
    if (attendees.length > 0) {
      addAuditEventToBatch(batch, {
        category: 'attendance',
        action: 'attendance.cleared',
        targetLabel: `출석 명단 ${attendees.length}명`,
        count: attendees.length,
        detail: attendees.map(attendee => attendee.name).join(', '),
      });
    }
    await batch.commit();
    toast.success('모든 대기 기록이 초기화되었습니다.');
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'attendees (batch)');
    toast.error('오류가 발생했습니다.');
    return false;
  }
}
