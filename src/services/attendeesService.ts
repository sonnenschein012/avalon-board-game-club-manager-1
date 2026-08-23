import { writeBatch, doc, collection, serverTimestamp, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Attendee, Member } from '../types';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { getMemberFromAttendee } from '../domain/matching/getMemberFromAttendee';
import { isSameName } from '../domain/matching/isSameName';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { parseAttendeeCsvRow } from '../domain/attendance/csvParser';

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

    await setDoc(docRef, newAttendeeData);

    if (member && member.status === '휴면') {
      const batch = writeBatch(db);
      batch.update(doc(db, 'members', member.id), { status: '활동', dormantSemester: '' });
      await batch.commit();
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

export function importAttendeesFile(
  file: File,
  attendees: Attendee[],
  members: Member[],
  onComplete: () => void
): void {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results: Papa.ParseResult<Record<string, string>>) => {
      try {
        const importDate = new Date();
        const importId = Math.random().toString(36).substring(7);
        let count = 0;
        const wokenUpNames: string[] = [];
        const operations: Parameters<typeof commitBatchesInChunks>[1] = [];

        attendees.forEach(a => {
          operations.push({ type: 'delete', ref: doc(db, 'attendees', a.id) });
        });

        results.data.forEach((row: Record<string, string>) => {
          const parsed = parseAttendeeCsvRow(row);
          if (parsed) {
            const docRef = doc(collection(db, 'attendees'));
            operations.push({
              type: 'set',
              ref: docRef,
              data: {
                ...parsed,
                importDate: Timestamp.fromDate(importDate),
                importId,
                status: '대기'
              }
            });
            count++;

            const member = getMemberFromAttendee(members, parsed.name, parsed.studentIdPrefix);
            if (member && member.status === '휴면') {
              operations.push({
                type: 'update',
                ref: doc(db, 'members', member.id),
                data: { status: '활동', dormantSemester: '' }
              });
              wokenUpNames.push(member.name);
            }
          }
        });

        await commitBatchesInChunks(db, operations);
        toast.success(`이전 목록이 삭제되고 ${count}명의 명단이 새로 임포트되었습니다.`);

        if (wokenUpNames.length > 0) {
          const uniqueWokenUp = Array.from(new Set(wokenUpNames));
          uniqueWokenUp.forEach(wokenName => {
            toast.success(`휴면 멤버 ${wokenName}님이 출석하여 활동 상태로 자동 전환되었습니다.`);
          });
        }
        onComplete();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'attendees (batch)');
        toast.error('임포트 중 오류가 발생했습니다.');
        onComplete();
      }
    }
  });
}

export async function clearAllAttendees(attendees: Attendee[]) {
  try {
    const batch = writeBatch(db);
    attendees.forEach(a => batch.delete(doc(db, 'attendees', a.id)));
    await batch.commit();
    toast.success('모든 대기 기록이 초기화되었습니다.');
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'attendees (batch)');
    toast.error('오류가 발생했습니다.');
    return false;
  }
}
