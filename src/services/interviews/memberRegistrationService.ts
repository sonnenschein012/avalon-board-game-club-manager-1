import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  defaultMemberNickname,
  formatMemberPhone,
  normalizeStudentYear,
} from '../../domain/members/memberIdentity';
import { db } from '../../lib/firebase';
import { addAuditEventToTransaction } from '../auditService';
import type { InterviewApplicant, Member } from '../../types';
import { actorEmail } from './shared';

export interface InterviewMemberRegistrationDraft {
  name: string;
  nickname: string;
  studentId: string;
  phone: string;
  gender: Member['gender'] | '';
  semester: string;
  preferredGenre: string[];
  memo: string;
  isBoardMember: boolean;
}

function assertSelectedApplicant(applicant: InterviewApplicant) {
  if (applicant.selectionStatus !== 'selected') throw new Error('선발된 지원자만 부원으로 등록할 수 있습니다.');
  if (applicant.memberId) throw new Error('이미 등록된 부원과 연결된 지원자입니다.');
}

export async function createMemberFromSelectedApplicant(
  applicantId: string,
  roundId: string,
  input: InterviewMemberRegistrationDraft,
) {
  const name = input.name.trim();
  const studentId = normalizeStudentYear(input.studentId);
  const nickname = input.nickname.trim() || defaultMemberNickname(name, studentId);
  const semester = input.semester.trim();
  if (!name || !studentId || !semester || !input.gender) throw new Error('이름, 학번, 성별, 가입 학기를 모두 입력해주세요.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  const memberRef = doc(collection(db, 'members'));

  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = { id: applicantSnapshot.id, ...applicantSnapshot.data() } as InterviewApplicant;
    assertSelectedApplicant(applicant);

    transaction.set(memberRef, {
      name,
      nickname,
      studentId,
      phone: formatMemberPhone(input.phone),
      gender: input.gender,
      semester,
      preferredGenre: input.preferredGenre,
      memo: input.memo.trim(),
      isBoardMember: input.isBoardMember,
      status: '활동',
      dormantSemester: '',
      registrationSource: { roundId, applicantId },
      createdAt: serverTimestamp(),
    });
    transaction.update(applicantRef, {
      memberId: memberRef.id,
      memberRegisteredAt: serverTimestamp(),
      memberRegisteredBy: actorEmail(),
      updatedAt: serverTimestamp(),
    });
    addAuditEventToTransaction(transaction, {
      category: 'member',
      action: 'member.created_from_applicant',
      targetId: memberRef.id,
      targetLabel: name,
      detail: `지원자 ${applicant.name} (${applicant.applicantNumber})에서 등록`,
    });
  });
  return memberRef.id;
}

export async function linkSelectedApplicantToMember(applicantId: string, memberId: string) {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  const memberRef = doc(db, 'members', memberId);
  await runTransaction(db, async transaction => {
    const [applicantSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(applicantRef),
      transaction.get(memberRef),
    ]);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    if (!memberSnapshot.exists()) throw new Error('연결할 부원을 찾을 수 없습니다.');
    const applicant = { id: applicantSnapshot.id, ...applicantSnapshot.data() } as InterviewApplicant;
    assertSelectedApplicant(applicant);
    const member = { id: memberSnapshot.id, ...memberSnapshot.data() } as Member;
    if (member.status === '휴면') {
      transaction.update(memberRef, { status: '활동', dormantSemester: '', lastReactivatedAt: serverTimestamp() });
    }
    transaction.update(applicantRef, {
      memberId,
      memberRegisteredAt: serverTimestamp(),
      memberRegisteredBy: actorEmail(),
      updatedAt: serverTimestamp(),
    });
    addAuditEventToTransaction(transaction, {
      category: 'member',
      action: 'member.linked_to_applicant',
      targetId: memberId,
      targetLabel: member.name,
      detail: `지원자 ${applicant.name} (${applicant.applicantNumber})와 연결${member.status === '휴면' ? ' · 활동 상태로 복원' : ''}`,
    });
  });
}

export async function clearApplicantMemberRegistration(applicantId: string) {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = { id: snapshot.id, ...snapshot.data() } as InterviewApplicant;
    transaction.update(applicantRef, {
      memberId: null,
      memberRegisteredAt: null,
      memberRegisteredBy: null,
      updatedAt: serverTimestamp(),
    });
    addAuditEventToTransaction(transaction, {
      category: 'member',
      action: 'member.unlinked_from_applicant',
      targetId: applicant.memberId ?? applicantId,
      targetLabel: applicant.name,
      detail: applicant.memberId ? `연결 부원 ID: ${applicant.memberId}` : '기존 연결 정보 없음',
    });
  });
}
