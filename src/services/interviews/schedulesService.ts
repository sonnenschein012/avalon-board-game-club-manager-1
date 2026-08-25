import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewV3Policy';
import { getAssignmentScheduleImpact } from '../../domain/interviews/scheduling';
import type { InterviewAccess, InterviewApplicant, InterviewRoundInterviewer, InterviewSchedule, InterviewScheduleInterviewer } from '../../types';
import type { InterviewScheduleDraft } from './models';
import { actorEmail, adminScheduleData, currentAssignmentRevision, getAssignmentLockId, mapSnapshot, publicScheduleData } from './shared';

const MAX_APPLICANTS_PER_SCHEDULE_MOVE = 100;

export function subscribeInterviewSchedules(
  roundId: string,
  onData: (schedules: InterviewSchedule[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'interviewSchedules'), where('roundId', '==', roundId)),
    snapshot => onData(mapSnapshot<InterviewSchedule>(snapshot).sort((left, right) => left.order - right.order)),
    onError,
  );
}

export function subscribeScheduleInterviewers(
  scheduleId: string,
  onData: (items: InterviewScheduleInterviewer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'interviewScheduleInterviewers'), where('scheduleId', '==', scheduleId)), snapshot => {
    onData(mapSnapshot<InterviewScheduleInterviewer>(snapshot).sort((left, right) => left.displayName.localeCompare(right.displayName)));
  }, onError);
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
      availability: interviewer.availability,
      active: interviewer.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return scheduleRef.id;
}

export async function updateInterviewSchedule(schedule: InterviewSchedule, draft: InterviewScheduleDraft): Promise<void> {
  const nextRevision = schedule.scheduleRevision + 1;
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewSchedules', schedule.id), adminScheduleData(schedule.roundId, draft, schedule.order, nextRevision));
  batch.set(doc(db, 'interviewPublicSchedules', schedule.id), publicScheduleData(schedule.roundId, draft, nextRevision));
  await batch.commit();
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
        ? [{ applicantId: applicant.id, applicant, assignment: applicant.assignment, ref: snapshot.ref }]
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
      const currentRevision = currentAssignmentRevision(item.applicant);
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
    return { cleanedResponseCount: affectedResponses.length, clearedAssignmentCount: assignmentImpact.affectedAssignmentCount };
  });
}

export async function archiveInterviewSchedule(schedule: InterviewSchedule): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'interviewSchedules', schedule.id), { status: 'archived', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'interviewPublicSchedules', schedule.id), { active: false, updatedAt: serverTimestamp() });
  await batch.commit();
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
      return { ref: snapshot.ref, applicant: snapshot.data() as InterviewApplicant };
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
    latestApplicants.forEach(({ ref, applicant }) => {
      if (applicant.scheduleId === scheduleId) return;
      moved += 1;
      const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
      const previousAssignment = applicant.assignment ?? null;
      const previousRevision = currentAssignmentRevision(applicant);
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
        applicantId: applicant.id,
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
    return applicants.length;
  });
}
