import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewPolicy';
import { getApplicantAssignmentRevision } from '../../domain/interviews/interviewTransitions';
import { assertExpectedRevision } from '../../domain/interviews/revisionConflict';
import { compareInterviewSchedules } from '../../domain/interviews/scheduleOrder';
import { getAssignmentScheduleImpact } from '../../domain/interviews/scheduling';
import { collectAuditChanges } from '../../domain/audit/auditEvent';
import { commitBatchesInChunks } from '../../lib/chunkBatch';
import { db } from '../../lib/firebase';
import {
  addAuditEventToBatch,
  addAuditEventToTransaction,
  createAuditEventOperation,
} from '../auditService';
import type { InterviewAccess, InterviewApplicant, InterviewRoundInterviewer, InterviewSchedule } from '../../types';
import type { InterviewScheduleDraft } from './models';
import { actorEmail, adminScheduleData, getAssignmentLockId, mapSnapshot, publicScheduleData } from './shared';

const MAX_APPLICANTS_PER_SCHEDULE_MOVE = 100;

const SCHEDULE_STATUS_LABELS: Record<InterviewSchedule['status'], string> = {
  draft: '준비 중',
  collecting: '응답 수집 중',
  closed: '응답 마감',
  interviewing: '면접 진행 중',
  finished: '종료',
  archived: '보관',
};

function scheduleAuditView(schedule: InterviewSchedule | InterviewScheduleDraft) {
  return {
    name: schedule.name.trim(),
    status: SCHEDULE_STATUS_LABELS[schedule.status],
    surveyOpensAt: schedule.surveyOpensAt instanceof Date
      ? schedule.surveyOpensAt.toLocaleString('ko-KR')
      : schedule.surveyOpensAt.toDate().toLocaleString('ko-KR'),
    surveyClosesAt: schedule.surveyClosesAt instanceof Date
      ? schedule.surveyClosesAt.toLocaleString('ko-KR')
      : schedule.surveyClosesAt.toDate().toLocaleString('ko-KR'),
    interviewDates: schedule.interviewDates,
    operatingHours: `${schedule.dayStartTime}~${schedule.dayEndTime}`,
    availabilitySlotMinutes: schedule.availabilitySlotMinutes,
    assignmentSlotMinutes: schedule.assignmentSlotMinutes,
    instructions: schedule.instructions.trim(),
  };
}

const SCHEDULE_AUDIT_FIELDS = [
  { key: 'name', label: '일정 이름' },
  { key: 'status', label: '상태' },
  { key: 'surveyOpensAt', label: '응답 시작' },
  { key: 'surveyClosesAt', label: '응답 마감' },
  { key: 'interviewDates', label: '면접일' },
  { key: 'operatingHours', label: '운영 시간' },
  { key: 'availabilitySlotMinutes', label: '가능시간 단위(분)' },
  { key: 'assignmentSlotMinutes', label: '배정 단위(분)' },
  { key: 'instructions', label: '안내문' },
] as const;

export function subscribeInterviewSchedules(
  roundId: string,
  onData: (schedules: InterviewSchedule[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewSchedules'), where('roundId', '==', roundId)),
    snapshot => onData(mapSnapshot<InterviewSchedule>(snapshot).sort(compareInterviewSchedules)),
    onError,
  );
}

export async function assignRoundInterviewerToSchedule(
  roundId: string,
  scheduleId: string,
  interviewerId: string,
): Promise<void> {
  const scheduleRef = doc(db, 'interviewSchedules', scheduleId);
  const rosterRef = doc(db, 'interviewRoundInterviewers', `${roundId}__${interviewerId}`);
  const participantRef = doc(db, 'interviewScheduleInterviewers', `${scheduleId}__${interviewerId}`);
  await runTransaction(db, async transaction => {
    const [scheduleSnapshot, rosterSnapshot, participantSnapshot] = await Promise.all([
      transaction.get(scheduleRef),
      transaction.get(rosterRef),
      transaction.get(participantRef),
    ]);
    if (!scheduleSnapshot.exists()) throw new Error('면접 일정을 찾을 수 없습니다.');
    const schedule = scheduleSnapshot.data() as InterviewSchedule;
    if (schedule.roundId !== roundId || schedule.status === 'archived') {
      throw new Error('현재 회차에서 사용할 수 없는 면접 일정입니다.');
    }
    if (!rosterSnapshot.exists()) throw new Error('면접관 명부에서 대상을 찾을 수 없습니다.');
    const interviewer = rosterSnapshot.data() as InterviewRoundInterviewer;
    if (!interviewer.active) throw new Error('명부에서 제외된 면접관은 일정에 추가할 수 없습니다.');
    const shared = {
      roundId,
      scheduleId,
      interviewerId,
      displayName: interviewer.displayName,
      email: interviewer.email,
      phone: interviewer.phone ?? null,
      active: true,
      updatedAt: serverTimestamp(),
    };
    if (participantSnapshot.exists()) {
      transaction.update(participantRef, shared);
    } else {
      transaction.set(participantRef, {
        ...shared,
        availability: [],
        createdAt: serverTimestamp(),
      });
    }
    addAuditEventToTransaction(transaction, {
      category: 'interview',
      action: 'interview.interviewer_schedule_assigned',
      targetId: interviewerId,
      targetLabel: interviewer.displayName,
      detail: `면접 일정: ${schedule.name}`,
    });
  });
}

export async function createInterviewSchedule(roundId: string, draft: InterviewScheduleDraft): Promise<string> {
  const [existing, interviewerSnapshots] = await Promise.all([
    getDocs(query(collection(db, 'interviewSchedules'), where('roundId', '==', roundId))),
    getDocs(query(collection(db, 'interviewRoundInterviewers'), where('roundId', '==', roundId))),
  ]);
  if (interviewerSnapshots.size > 450) throw new Error('면접관 수가 너무 많아 일정을 한 번에 만들 수 없습니다.');
  const order = existing.docs.reduce((max, snapshot) => Math.max(max, Number(snapshot.data().order) || 0), 0) + 1;
  const scheduleRef = doc(collection(db, 'interviewSchedules'));
  const batch = writeBatch(db);
  batch.set(scheduleRef, { ...adminScheduleData(roundId, draft, order, 1), createdAt: serverTimestamp() });
  batch.set(doc(db, 'interviewPublicSchedules', scheduleRef.id), publicScheduleData(roundId, draft, 1));
  interviewerSnapshots.docs.forEach(snapshot => {
    const interviewer = snapshot.data() as InterviewRoundInterviewer;
    batch.set(doc(db, 'interviewScheduleInterviewers', `${scheduleRef.id}__${interviewer.interviewerId}`), {
      roundId,
      scheduleId: scheduleRef.id,
      interviewerId: interviewer.interviewerId,
      displayName: interviewer.displayName,
      email: interviewer.email,
      phone: interviewer.phone ?? null,
      availability: [],
      active: interviewer.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  addAuditEventToBatch(batch, {
    category: 'interview',
    action: 'interview.schedule_created',
    targetId: scheduleRef.id,
    targetLabel: draft.name.trim(),
    detail: `면접관 ${interviewerSnapshots.size}명을 일정 명부에 함께 등록`,
  });
  await batch.commit();
  return scheduleRef.id;
}

/** Applies a schedule edit while removing responses and assignments that no
 * longer fit the edited slots. The transaction prevents overwriting a public
 * response submitted at the same time as the admin save. */
export async function applyConcreteInterviewScheduleChange(
  roundId: string,
  scheduleId: string,
  draft: InterviewScheduleDraft,
  accessRecordIds: string[],
  applicantRecordIds: string[],
  expectedScheduleRevision?: number,
): Promise<{ cleanedResponseCount: number; clearedAssignmentCount: number }> {
  if (accessRecordIds.length + applicantRecordIds.length > 198) {
    throw new Error('한 번에 변경할 수 있는 해당 일정의 면접 데이터 수(99명)를 초과했습니다.');
  }
  const allowedSlots = new Set(draft.allowedSlots);
  return runTransaction(db, async transaction => {
    const scheduleRef = doc(db, 'interviewSchedules', scheduleId);
    const accessRefs = accessRecordIds.map(id => doc(db, 'interviewAccess', id));
    const applicantRefs = applicantRecordIds.map(id => doc(db, 'interviewApplicants', id));
    const [scheduleSnapshot, accessSnapshots, applicantSnapshots] = await Promise.all([
      transaction.get(scheduleRef),
      Promise.all(accessRefs.map(ref => transaction.get(ref))),
      Promise.all(applicantRefs.map(ref => transaction.get(ref))),
    ]);
    if (!scheduleSnapshot.exists()) throw new Error('면접 일정을 찾을 수 없습니다.');
    const currentSchedule = scheduleSnapshot.data() as InterviewSchedule;
    if (currentSchedule.roundId !== roundId || currentSchedule.status === 'archived') throw new Error('현재 회차에서 수정할 수 없는 면접 일정입니다.');
    assertExpectedRevision(currentSchedule.scheduleRevision, expectedScheduleRevision, '면접 일정 설정');

    const affectedResponses = accessSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const access = snapshot.data() as InterviewAccess;
      if (access.roundId !== roundId || access.scheduleId !== scheduleId) return [];
      const availability = access.availability.filter(slot => allowedSlots.has(slot));
      return availability.length === access.availability.length ? [] : [{ ref: snapshot.ref, availability }];
    });
    const currentApplicants = applicantSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const applicant = snapshot.data() as InterviewApplicant;
      return applicant.roundId === roundId && applicant.scheduleId === scheduleId
        ? [{ applicantId: snapshot.id, applicant, assignment: applicant.assignment, ref: snapshot.ref }]
        : [];
    });
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      currentApplicants,
    );
    const applicantsById = new Map(currentApplicants.map(item => [item.applicantId, item]));
    const nextRevision = currentSchedule.scheduleRevision + 1;
    transaction.update(scheduleRef, adminScheduleData(roundId, draft, currentSchedule.order, nextRevision));
    transaction.set(doc(db, 'interviewPublicSchedules', scheduleId), publicScheduleData(roundId, draft, nextRevision));
    affectedResponses.forEach(item => transaction.update(item.ref, { availability: item.availability, updatedAt: serverTimestamp() }));
    assignmentImpact.affectedAssignments.forEach(impact => {
      const item = applicantsById.get(impact.applicantId);
      if (!item) return;
      const currentRevision = getApplicantAssignmentRevision(item.applicant);
      if (item.assignment?.slotId) transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, item.assignment)));
      transaction.update(item.ref, {
        assignment: null,
        previousAssignment: item.assignment ?? null,
        assignmentRevision: currentRevision + 1,
        updatedAt: serverTimestamp(),
      });
      transaction.update(doc(db, 'interviewAccess', item.applicant.accessToken), { assignmentSummary: null });
      transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
        roundId,
        scheduleId,
        scheduleName: draft.name.trim(),
        applicantId: item.applicantId,
        type: 'unassigned',
        previousAssignment: item.assignment ?? null,
        nextAssignment: null,
        previousRevision: currentRevision,
        nextRevision: currentRevision + 1,
        reason: '면접 일정 설정 변경',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    });
    const changes = collectAuditChanges(
      scheduleAuditView(currentSchedule),
      scheduleAuditView(draft),
      SCHEDULE_AUDIT_FIELDS,
    );
    if (changes.length > 0 || affectedResponses.length > 0 || assignmentImpact.affectedAssignmentCount > 0) {
      addAuditEventToTransaction(transaction, {
        category: 'interview',
        action: 'interview.schedule_updated',
        targetId: scheduleId,
        targetLabel: draft.name.trim(),
        changes,
        detail: `유효하지 않은 응답 ${affectedResponses.length}건 정리, 배정 ${assignmentImpact.affectedAssignmentCount}건 해제`,
      });
    }
    return { cleanedResponseCount: affectedResponses.length, clearedAssignmentCount: assignmentImpact.affectedAssignmentCount };
  });
}

const SCHEDULE_DELETE_BLOCKER_COLLECTIONS = [
  'interviewApplicants',
  'interviewAccess',
  'interviewAssignmentLocks',
  'interviewAssignmentEvents',
  'interviewRecordEvents',
  'interviewChangeRequests',
] as const;

export interface InterviewScheduleDeletionResult {
  deletedDocuments: number;
}

/** Permanently removes an unused schedule. Any current or historical
 * applicant linkage blocks deletion so interview records cannot be orphaned. */
export async function deleteInterviewSchedule(schedule: InterviewSchedule): Promise<InterviewScheduleDeletionResult> {
  const scheduleRef = doc(db, 'interviewSchedules', schedule.id);
  const scheduleSnapshot = await getDoc(scheduleRef);
  if (!scheduleSnapshot.exists()) throw new Error('삭제할 면접 일정을 찾을 수 없습니다.');
  const current = scheduleSnapshot.data() as InterviewSchedule;
  if (current.roundId !== schedule.roundId) throw new Error('다른 면접 회차의 일정은 삭제할 수 없습니다.');

  const blockerSnapshots = await Promise.all(SCHEDULE_DELETE_BLOCKER_COLLECTIONS.map(collectionName => (
    getDocs(query(collection(db, collectionName), where('scheduleId', '==', schedule.id), limit(1)))
  )));
  if (blockerSnapshots.some(snapshot => !snapshot.empty)) {
    throw new Error('지원자 또는 면접 기록이 연결된 일정은 삭제할 수 없습니다.');
  }

  const participantSnapshot = await getDocs(query(
    collection(db, 'interviewScheduleInterviewers'),
    where('scheduleId', '==', schedule.id),
  ));
  const dependentRefs = [
    doc(db, 'interviewPublicSchedules', schedule.id),
    ...participantSnapshot.docs.map(item => item.ref),
  ];
  await commitBatchesInChunks(db, dependentRefs.map(ref => ({ type: 'delete' as const, ref })));
  await commitBatchesInChunks(db, [
    { type: 'delete', ref: scheduleRef },
    createAuditEventOperation({
      category: 'interview',
      action: 'interview.schedule_deleted',
      targetId: schedule.id,
      targetLabel: current.name,
      detail: `관련 공개 일정 및 면접관 명부 ${dependentRefs.length}건 함께 삭제`,
    }),
  ]);
  return { deletedDocuments: dependentRefs.length + 1 };
}

/**
 * Adds applicants to a concrete schedule. A move intentionally clears the old
 * response and assignment: their slot IDs are only meaningful in the old
 * schedule. Assignment history remains in the existing event collections.
 */
export async function assignApplicantsToInterviewSchedule(
  roundId: string,
  scheduleId: string,
  applicantIds: string[],
): Promise<number> {
  const uniqueApplicantIds = [...new Set(applicantIds)];
  if (uniqueApplicantIds.length === 0) return 0;
  if (uniqueApplicantIds.length > MAX_APPLICANTS_PER_SCHEDULE_MOVE) {
    throw new Error(`한 번에 ${MAX_APPLICANTS_PER_SCHEDULE_MOVE}명까지 면접 일정을 지정할 수 있습니다.`);
  }

  return runTransaction(db, async transaction => {
    const scheduleRef = doc(db, 'interviewSchedules', scheduleId);
    const scheduleSnapshot = await transaction.get(scheduleRef);
    if (!scheduleSnapshot.exists()) throw new Error('면접 일정을 찾을 수 없습니다.');
    const schedule = scheduleSnapshot.data() as InterviewSchedule;
    if (schedule.roundId !== roundId || schedule.status === 'archived') throw new Error('현재 회차에서 사용할 수 없는 면접 일정입니다.');

    const applicantRefs = uniqueApplicantIds.map(id => doc(db, 'interviewApplicants', id));
    const applicantSnapshots = await Promise.all(applicantRefs.map(ref => transaction.get(ref)));
    const latestApplicants = applicantSnapshots.map(snapshot => {
      if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
      return { applicantId: snapshot.id, ref: snapshot.ref, applicant: snapshot.data() as InterviewApplicant };
    });
    const accessSnapshots = await Promise.all(latestApplicants.map(({ applicant }) => transaction.get(doc(db, 'interviewAccess', applicant.accessToken))));
    const requestSnapshots = await Promise.all(latestApplicants.map(({ applicant }) => transaction.get(doc(db, 'interviewChangeRequests', applicant.accessToken))));

    latestApplicants.forEach(({ applicant }, index) => {
      if (applicant.roundId !== roundId) throw new Error('다른 면접 회차의 지원자가 포함되어 있습니다.');
      if ((applicant.lifecycle ?? 'active') !== 'active' || (applicant.applicationStatus ?? 'active') !== 'active') {
        throw new Error(`${applicant.name} 지원자는 지원 철회 또는 보관 상태입니다.`);
      }
      if (getInterviewProgressStatus(applicant) === 'completed') throw new Error(`${applicant.name} 지원자는 면접 완료 상태라 일정을 옮길 수 없습니다.`);
      if (requestSnapshots[index]?.data()?.status === 'open') throw new Error(`${applicant.name} 지원자의 일정 변경 요청을 먼저 처리해주세요.`);
      if (!accessSnapshots[index]?.exists()) throw new Error(`${applicant.name} 지원자의 공개 링크 정보를 찾을 수 없습니다.`);
    });

    let moved = 0;
    const movedApplicantNames: string[] = [];
    latestApplicants.forEach(({ applicantId, ref, applicant }) => {
      if (applicant.scheduleId === scheduleId) return;
      moved += 1;
      movedApplicantNames.push(applicant.name);
      const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
      const previousAssignment = applicant.assignment ?? null;
      const previousRevision = getApplicantAssignmentRevision(applicant);
      const nextRevision = previousAssignment ? previousRevision + 1 : previousRevision;
      const nextScheduleRevision = (applicant.scheduleAssignmentRevision ?? 0) + 1;
      if (previousAssignment?.slotId) transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, previousAssignment)));
      transaction.update(ref, {
        scheduleId,
        scheduleAssignedAt: serverTimestamp(),
        scheduleAssignmentRevision: nextScheduleRevision,
        availabilityMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        reminderMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null },
        confirmationMessage: { firstMarkedSentAt: null, lastMarkedSentAt: null, assignmentRevision: 0 },
        assignment: null,
        previousAssignment,
        assignmentRevision: nextRevision,
        interviewStatus: 'scheduled',
        actionNeededReason: null,
        updatedAt: serverTimestamp(),
      });
      transaction.update(accessRef, {
        scheduleId,
        scheduleAssignmentRevision: nextScheduleRevision,
        availability: [],
        submittedAt: null,
        updatedAt: null,
        responseUpdatedAt: null,
        firstAccessedAt: null,
        assignmentSummary: null,
      } satisfies Partial<InterviewAccess>);
      transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
        roundId,
        scheduleId,
        scheduleName: schedule.name,
        applicantId,
        type: previousAssignment ? 'changed' : 'schedule_assigned',
        previousAssignment,
        nextAssignment: null,
        previousRevision,
        nextRevision,
        reason: previousAssignment ? '면접 일정 변경' : '면접 일정 지정',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    });
    if (moved > 0) {
      addAuditEventToTransaction(transaction, {
        category: 'interview',
        action: 'interview.schedule_applicants_assigned',
        targetId: scheduleId,
        targetLabel: schedule.name,
        count: moved,
        detail: movedApplicantNames.join(', '),
      });
    }
    return moved;
  });
}

/**
 * Moves records created before interview schedules existed into a schedule
 * cloned from their old round. Unlike a normal schedule move, this keeps the
 * saved availability and confirmed assignment intact.
 */
export async function migrateLegacyApplicantsToInterviewSchedule(
  roundId: string,
  scheduleId: string,
  applicantIds: string[],
): Promise<number> {
  const uniqueApplicantIds = [...new Set(applicantIds)];
  if (uniqueApplicantIds.length === 0) return 0;
  if (uniqueApplicantIds.length > MAX_APPLICANTS_PER_SCHEDULE_MOVE) {
    throw new Error(`한 번에 ${MAX_APPLICANTS_PER_SCHEDULE_MOVE}명까지 기존 지원자를 가져올 수 있습니다.`);
  }

  return runTransaction(db, async transaction => {
    const scheduleSnapshot = await transaction.get(doc(db, 'interviewSchedules', scheduleId));
    if (!scheduleSnapshot.exists()) throw new Error('면접 일정을 찾을 수 없습니다.');
    const schedule = scheduleSnapshot.data() as InterviewSchedule;
    if (schedule.roundId !== roundId || schedule.status === 'archived') throw new Error('현재 회차에서 사용할 수 없는 면접 일정입니다.');

    const applicantRefs = uniqueApplicantIds.map(id => doc(db, 'interviewApplicants', id));
    const applicantSnapshots = await Promise.all(applicantRefs.map(ref => transaction.get(ref)));
    const applicants = applicantSnapshots.map(snapshot => {
      if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
      return { ref: snapshot.ref, applicant: snapshot.data() as InterviewApplicant };
    });
    const accessSnapshots = await Promise.all(applicants.map(({ applicant }) => transaction.get(doc(db, 'interviewAccess', applicant.accessToken))));

    applicants.forEach(({ applicant }, index) => {
      if (applicant.roundId !== roundId) throw new Error('다른 회차의 지원자가 포함되어 있습니다.');
      if (applicant.scheduleId !== undefined) throw new Error(`${applicant.name} 지원자는 이미 새 면접 일정 구조에 포함되어 있습니다.`);
      if (!accessSnapshots[index]?.exists()) throw new Error(`${applicant.name} 지원자의 공개 링크 정보를 찾을 수 없습니다.`);
    });

    applicants.forEach(({ ref, applicant }) => {
      const scheduleAssignmentRevision = (applicant.scheduleAssignmentRevision ?? 0) + 1;
      const assignment = applicant.assignment
        ? { ...applicant.assignment, scheduleId, scheduleName: schedule.name }
        : null;
      transaction.update(ref, {
        scheduleId,
        scheduleAssignedAt: serverTimestamp(),
        scheduleAssignmentRevision,
        assignment,
        updatedAt: serverTimestamp(),
      });
      transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
        scheduleId,
        scheduleAssignmentRevision,
      });
    });
    addAuditEventToTransaction(transaction, {
      category: 'interview',
      action: 'interview.legacy_applicants_migrated',
      targetId: scheduleId,
      targetLabel: schedule.name,
      count: applicants.length,
      detail: applicants.map(({ applicant }) => applicant.name).join(', '),
    });
    return applicants.length;
  });
}
