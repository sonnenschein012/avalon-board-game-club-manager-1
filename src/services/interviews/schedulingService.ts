import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { availabilityToAssignmentCandidates, getAssignmentScheduleImpact } from '../../domain/interviews/scheduling';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewV3Policy';
import {
  prepareScheduleResetTransition,
  prepareWithdrawalTransition,
} from '../../domain/interviews/interviewTransitions';
import type {
  InterviewAccess,
  InterviewApplicant,
  InterviewAssignment,
  InterviewNote,
  InterviewProgressStatus,
  InterviewRound,
  InterviewRoundInterviewer,
  InterviewSchedule,
  InterviewScheduleInterviewer,
} from '../../types';
import type { AssignmentProposalWrite, InterviewRoundDraft } from './models';
import {
  actorEmail,
  adminRoundData,
  currentAssignmentRevision,
  getAssignmentLockId,
  hasInterviewRecord,
  interviewRecordSnapshot,
  isActiveApplicant,
  isCurrentConfirmationSent,
  publicRoundData,
} from './shared';

export async function saveInterviewAssignment(
  applicantId: string,
  assignment: InterviewAssignment | null,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (assignment && !isActiveApplicant(applicant)) {
      throw new Error('지원 철회 또는 보관된 지원자는 배정할 수 없습니다.');
    }
    const currentAssignment = applicant.assignment;
    const assignmentChanges = currentAssignment?.slotId !== assignment?.slotId
      || currentAssignment?.interviewerId !== assignment?.interviewerId;
    const changeGateOpen = currentAssignment?.status === 'change_requested'
      || currentAssignment?.status === 'needs_reschedule';
    if (assignmentChanges && isCurrentConfirmationSent(applicant) && !changeGateOpen) {
      throw new Error('확정 배정은 바로 변경할 수 없습니다. 먼저 변경 필요 상태로 전환해주세요.');
    }
    const previousRevision = currentAssignmentRevision(applicant);
    const nextRevision = previousRevision + 1;
    const scheduleId = applicant.scheduleId ?? null;
    const nextAssignment = assignment
      ? { ...assignment, scheduleId, status: 'scheduled' as const, confirmationRevision: nextRevision }
      : null;

    let nextLockRef: DocumentReference | null = null;
    if (nextAssignment) {
      nextLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, nextAssignment));
      const configRef = scheduleId
        ? doc(db, 'interviewSchedules', scheduleId)
        : doc(db, 'interviewRounds', applicant.roundId);
      const participantRef = scheduleId
        ? doc(db, 'interviewScheduleInterviewers', `${scheduleId}__${nextAssignment.interviewerId}`)
        : doc(db, 'interviewRoundInterviewers', `${applicant.roundId}__${nextAssignment.interviewerId}`);
      const [lockSnapshot, configSnapshot, accessSnapshot, participantSnapshot] = await Promise.all([
        transaction.get(nextLockRef),
        transaction.get(configRef),
        transaction.get(doc(db, 'interviewAccess', applicant.accessToken)),
        transaction.get(participantRef),
      ]);
      if (lockSnapshot.exists() && lockSnapshot.data().applicantId !== applicantId) {
        throw new Error('같은 면접관에게 이미 배정된 시간입니다.');
      }
      if (!configSnapshot.exists() || !accessSnapshot.exists() || !participantSnapshot.exists()) throw new Error('최신 면접 가능시간 정보를 찾을 수 없습니다.');
      const scheduleConfig = configSnapshot.data() as InterviewRound | InterviewSchedule;
      const access = accessSnapshot.data() as InterviewAccess;
      const participant = participantSnapshot.data() as InterviewRoundInterviewer | InterviewScheduleInterviewer;
      const applicantCandidates = availabilityToAssignmentCandidates(access.availability, scheduleConfig.availabilitySlotMinutes, scheduleConfig.assignmentSlotMinutes);
      const interviewerCandidates = availabilityToAssignmentCandidates(participant.availability, scheduleConfig.availabilitySlotMinutes, scheduleConfig.assignmentSlotMinutes);
      if (!participant.active || !nextAssignment.slotId || !applicantCandidates.includes(nextAssignment.slotId) || !interviewerCandidates.includes(nextAssignment.slotId)) {
        throw new Error('지원자와 면접관의 최신 가능시간이 겹치지 않습니다.');
      }
      if (nextAssignment.durationMinutes !== scheduleConfig.assignmentSlotMinutes) throw new Error('현재 면접 일정의 배정 단위와 다릅니다.');
    }

    if (currentAssignment?.slotId) {
      const currentLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, currentAssignment));
      if (!nextLockRef || currentLockRef.path !== nextLockRef.path) transaction.delete(currentLockRef);
    }
    if (nextLockRef && nextAssignment) {
      transaction.set(nextLockRef, {
        roundId: applicant.roundId,
        scheduleId,
        applicantId,
        interviewerId: nextAssignment.interviewerId,
        slotId: nextAssignment.slotId,
        startsAt: nextAssignment.startsAt,
        durationMinutes: nextAssignment.durationMinutes,
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(applicantRef, {
      assignment: nextAssignment,
      previousAssignment: currentAssignment ?? null,
      assignmentRevision: nextRevision,
      ...(nextAssignment ? { interviewStatus: 'scheduled', actionNeededReason: null } : {}),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      assignmentSummary: nextAssignment?.slotId ? {
        slotId: nextAssignment.slotId,
        status: nextAssignment.status,
        revision: nextRevision,
      } : null,
    });
    const eventRef = doc(collection(db, 'interviewAssignmentEvents'));
    transaction.set(eventRef, {
      roundId: applicant.roundId,
      scheduleId,
      scheduleName: nextAssignment?.scheduleName ?? currentAssignment?.scheduleName ?? null,
      applicantId,
      type: !currentAssignment && nextAssignment ? 'assigned' : currentAssignment && !nextAssignment ? 'unassigned' : 'changed',
      previousAssignment: currentAssignment ?? null,
      nextAssignment,
      previousRevision,
      nextRevision,
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function applyInterviewAssignmentProposals(
  roundId: string,
  proposals: AssignmentProposalWrite[],
  scheduleId: string | null = null,
): Promise<number> {
  const resourceKeys = proposals.map(proposal => `${proposal.interviewerId}|${proposal.slotId}`);
  if (new Set(resourceKeys).size !== resourceKeys.length) throw new Error('초안 안에 면접관 시간 충돌이 있습니다.');
  if (new Set(proposals.map(proposal => proposal.applicantId)).size !== proposals.length) throw new Error('한 지원자가 초안에 두 번 포함되어 있습니다.');
  await runTransaction(db, async transaction => {
    const applicantRefs = proposals.map(proposal => doc(db, 'interviewApplicants', proposal.applicantId));
    const applicantSnapshots = await Promise.all(applicantRefs.map(ref => transaction.get(ref)));
    const configRef = scheduleId ? doc(db, 'interviewSchedules', scheduleId) : doc(db, 'interviewRounds', roundId);
    const configSnapshot = await transaction.get(configRef);
    if (!configSnapshot.exists()) throw new Error(scheduleId ? '면접 일정을 찾을 수 없습니다.' : '면접 회차를 찾을 수 없습니다.');
    const scheduleConfig = configSnapshot.data() as InterviewRound | InterviewSchedule;
    const accessSnapshots = await Promise.all(applicantSnapshots.map(snapshot => {
      const applicant = snapshot.data() as InterviewApplicant | undefined;
      return applicant?.accessToken ? transaction.get(doc(db, 'interviewAccess', applicant.accessToken)) : Promise.resolve(null);
    }));
    const participantIds = [...new Set(proposals.map(proposal => proposal.interviewerId))];
    const participantCollection = scheduleId ? 'interviewScheduleInterviewers' : 'interviewRoundInterviewers';
    const participantSnapshots = await Promise.all(participantIds.map(interviewerId => transaction.get(doc(db, participantCollection, `${scheduleId ?? roundId}__${interviewerId}`))));
    const participantByInterviewer = new Map(participantSnapshots.filter(snapshot => snapshot.exists()).map(snapshot => {
      const data = snapshot.data() as InterviewRoundInterviewer | InterviewScheduleInterviewer;
      return [data.interviewerId, data] as const;
    }));
    const nextLockRefs = proposals.map(proposal => doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, proposal)));
    const nextLockSnapshots = await Promise.all(nextLockRefs.map(ref => transaction.get(ref)));
    const proposalByApplicant = new Map(proposals.map(proposal => [proposal.applicantId, proposal]));
    nextLockSnapshots.forEach((snapshot, index) => {
      const proposal = proposals[index];
      const holderId = snapshot.data()?.applicantId as string | undefined;
      const holderProposal = holderId ? proposalByApplicant.get(holderId) : undefined;
      const holderMovesAway = holderProposal && proposal
        ? `${holderProposal.interviewerId}|${holderProposal.slotId}` !== `${proposal.interviewerId}|${proposal.slotId}`
        : false;
      if (snapshot.exists() && holderId !== proposal?.applicantId && !holderMovesAway) {
        throw new Error('검토 중 다른 운영진이 같은 면접관 시간에 배정했습니다. 자동 배정을 다시 실행해주세요.');
      }
    });
    applicantSnapshots.forEach((applicantSnapshot, index) => {
      const proposal = proposals[index];
      if (!applicantSnapshot?.exists() || !proposal) return;
      const current = (applicantSnapshot.data() as InterviewApplicant).assignment;
      if (!current?.slotId) return;
      const currentLockRef = doc(db, 'interviewAssignmentLocks', getAssignmentLockId(roundId, current));
      if (currentLockRef.path !== nextLockRefs[index]?.path) transaction.delete(currentLockRef);
    });
    proposals.forEach((proposal, index) => {
      const applicantSnapshot = applicantSnapshots[index];
      if (!applicantSnapshot?.exists()) throw new Error('지원자를 찾을 수 없습니다.');
      const applicant = applicantSnapshot.data() as InterviewApplicant;
      if (applicant.roundId !== roundId) throw new Error('다른 회차의 지원자가 포함되어 있습니다.');
      if ((applicant.scheduleId ?? null) !== scheduleId) throw new Error(`${applicant.name} 지원자가 현재 면접 일정에 속하지 않습니다.`);
      if (!isActiveApplicant(applicant)) throw new Error(`${applicant.name} 지원자는 지원 철회 또는 보관 상태입니다.`);
      const current = applicant.assignment;
      const proposalChangesAssignment = current?.slotId !== proposal.slotId
        || current?.interviewerId !== proposal.interviewerId;
      const changeGateOpen = current?.status === 'change_requested'
        || current?.status === 'needs_reschedule';
      if (proposalChangesAssignment && isCurrentConfirmationSent(applicant) && !changeGateOpen) {
        throw new Error(`${applicant.name} 지원자의 확정 배정은 변경 필요 전환 없이 수정할 수 없습니다.`);
      }
      const previousRevision = currentAssignmentRevision(applicant);
      if (proposal.expectedAssignmentRevision !== previousRevision) {
        throw new Error(`${applicant.name} 지원자의 일정이 초안 작성 후 변경되었습니다. 자동 배정을 다시 실행해주세요.`);
      }
      const progressStatus = applicant.interviewStatus
        ?? (current?.status === 'completed' ? 'completed' : 'scheduled');
      if (progressStatus === 'completed' || progressStatus === 'action_needed') {
        throw new Error(`${applicant.name} 지원자는 면접 완료 또는 조치 필요 상태입니다. 먼저 별도 절차로 상태를 처리해주세요.`);
      }
      if (current && ['completed', 'no_show', 'cancelled', 'needs_reschedule'].includes(current.status)) {
        throw new Error(`${applicant.name} 지원자의 현재 면접 상태에는 자동 배정을 적용할 수 없습니다.`);
      }
      const access = accessSnapshots[index]?.data() as InterviewAccess | undefined;
      if (access?.changeRequestStatus === 'open') {
        throw new Error(`${applicant.name} 지원자는 일정 변경 요청을 처리한 뒤 자동 배정할 수 있습니다.`);
      }
      const participant = participantByInterviewer.get(proposal.interviewerId);
      const applicantCandidates = availabilityToAssignmentCandidates(access?.availability ?? [], scheduleConfig.availabilitySlotMinutes, scheduleConfig.assignmentSlotMinutes);
      const interviewerCandidates = availabilityToAssignmentCandidates(participant?.availability ?? [], scheduleConfig.availabilitySlotMinutes, scheduleConfig.assignmentSlotMinutes);
      if (!participant?.active || !applicantCandidates.includes(proposal.slotId) || !interviewerCandidates.includes(proposal.slotId)) {
        throw new Error(`${applicant.name} 지원자의 초안 후보가 최신 가능시간과 다릅니다. 자동 배정을 다시 실행해주세요.`);
      }
      if (proposal.durationMinutes !== scheduleConfig.assignmentSlotMinutes) throw new Error('면접 배정 단위가 변경되었습니다. 자동 배정을 다시 실행해주세요.');
      if (current?.locked && (current.slotId !== proposal.slotId || current.interviewerId !== proposal.interviewerId)) {
        throw new Error(`${applicant.name} 지원자의 잠긴 배정이 변경되었습니다.`);
      }
      const assignmentChanges = !current
        || current.slotId !== proposal.slotId
        || current.interviewerId !== proposal.interviewerId;
      if (assignmentChanges && isCurrentConfirmationSent(applicant)) {
        throw new Error(`${applicant.name} 지원자는 현재 일정의 확정 안내를 받아 자동으로 이동할 수 없습니다.`);
      }
      const revision = previousRevision + 1;
      const next: InterviewAssignment = {
        scheduleId,
        scheduleName: scheduleId && 'name' in scheduleConfig ? scheduleConfig.name : null,
        slotId: proposal.slotId,
        startsAt: proposal.startsAt,
        durationMinutes: proposal.durationMinutes,
        interviewerId: proposal.interviewerId,
        interviewerName: proposal.interviewerName,
        status: 'scheduled',
        locked: proposal.locked,
        source: proposal.source,
        confirmationRevision: revision,
      };
      transaction.set(nextLockRefs[index]!, {
        roundId,
        scheduleId,
        applicantId: proposal.applicantId,
        interviewerId: proposal.interviewerId,
        slotId: proposal.slotId,
        startsAt: proposal.startsAt,
        durationMinutes: proposal.durationMinutes,
        updatedAt: serverTimestamp(),
      });
      transaction.update(applicantRefs[index]!, {
        assignment: next,
        previousAssignment: current ?? null,
        assignmentRevision: revision,
        interviewStatus: 'scheduled',
        actionNeededReason: null,
        updatedAt: serverTimestamp(),
      });
      transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
        assignmentSummary: { slotId: next.slotId, status: next.status, revision },
      });
      transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
        roundId,
        scheduleId,
        scheduleName: next.scheduleName ?? null,
        applicantId: proposal.applicantId,
        type: current ? 'changed' : 'assigned',
        previousAssignment: current ?? null,
        nextAssignment: next,
        previousRevision,
        nextRevision: revision,
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    });
  });
  return proposals.length;
}

export async function updateInterviewAssignmentState(
  applicantId: string,
  patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>,
): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!applicant.assignment) throw new Error('면접 배정이 없습니다.');
    if (patch.status === 'completed') throw new Error('면접 완료는 종합평가와 함께 완료 기능에서 처리해야 합니다.');
    if (patch.status && getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('이미 완료된 면접의 배정 상태는 이 기능으로 변경할 수 없습니다.');
    }
    const next = { ...applicant.assignment, ...patch };
    const actionNeeded = patch.status != null
      && ['change_requested', 'no_show', 'cancelled', 'needs_reschedule'].includes(patch.status);
    const actionNeededReason = patch.status === 'no_show'
      ? '면접 불참'
      : patch.status === 'cancelled'
        ? '면접 취소'
        : patch.status === 'needs_reschedule' || patch.status === 'change_requested'
          ? '일정 재조율 필요'
          : null;
    transaction.update(applicantRef, {
      assignment: next,
      ...(actionNeeded ? {
        interviewStatus: 'action_needed' satisfies InterviewProgressStatus,
        actionNeededReason,
      } : patch.status ? {
        interviewStatus: 'scheduled' satisfies InterviewProgressStatus,
        actionNeededReason: null,
      } : {}),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': next.status,
    });
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: patch.locked === true ? 'locked' : patch.locked === false ? 'unlocked' : 'status_changed',
      previousAssignment: applicant.assignment,
      nextAssignment: next,
      previousRevision: currentAssignmentRevision(applicant),
      nextRevision: currentAssignmentRevision(applicant),
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function applyInterviewScheduleChange(
  roundId: string,
  draft: InterviewRoundDraft,
  accessRecordIds: string[],
  applicantRecordIds: string[],
): Promise<{ cleanedResponseCount: number; clearedAssignmentCount: number }> {
  const allowed = new Set(draft.allowedSlots);
  if (accessRecordIds.length + applicantRecordIds.length > 498) {
    throw new Error('한 번에 변경할 수 있는 면접 데이터 수(498건)를 초과했습니다.');
  }

  return runTransaction(db, async transaction => {
    // Transaction reads are retried if a public submission races this save,
    // preventing the cleanup from replacing a newer availability response.
    const accessRefs = accessRecordIds.map(id => doc(db, 'interviewAccess', id));
    const applicantRefs = applicantRecordIds.map(id => doc(db, 'interviewApplicants', id));
    const [accessSnapshots, applicantSnapshots] = await Promise.all([
      Promise.all(accessRefs.map(ref => transaction.get(ref))),
      Promise.all(applicantRefs.map(ref => transaction.get(ref))),
    ]);
    const affected = accessSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const data = snapshot.data() as InterviewAccess;
      if (data.roundId !== roundId) return [];
      const nextAvailability = data.availability.filter(slot => allowed.has(slot));
      return nextAvailability.length === data.availability.length
        ? []
        : [{ ref: snapshot.ref, availability: nextAvailability }];
    });
    const latestApplicants = applicantSnapshots.flatMap(snapshot => {
      if (!snapshot.exists()) return [];
      const data = snapshot.data() as InterviewApplicant;
      return data.roundId === roundId
        ? [{ applicantId: snapshot.id, assignment: data.assignment, applicant: data, ref: snapshot.ref }]
        : [];
    });
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      latestApplicants,
    );
    const applicantRefsById = new Map(latestApplicants.map(item => [item.applicantId, item.ref]));

    const roundRef = doc(db, 'interviewRounds', roundId);
    const currentRoundSnapshot = await transaction.get(roundRef);
    const nextScheduleRevision = ((currentRoundSnapshot.data()?.scheduleRevision as number | undefined) ?? 0) + 1;
    transaction.update(roundRef, adminRoundData(draft, nextScheduleRevision));
    transaction.set(doc(db, 'interviewPublicRounds', roundId), publicRoundData(draft, nextScheduleRevision));
    affected.forEach(item => transaction.update(item.ref, {
      availability: item.availability,
      updatedAt: serverTimestamp(),
    }));
    assignmentImpact.affectedAssignments.forEach(item => {
      const ref = applicantRefsById.get(item.applicantId);
      if (ref) {
        const applicant = latestApplicants.find(candidate => candidate.applicantId === item.applicantId);
        const currentRevision = applicant ? currentAssignmentRevision(applicant.applicant) : 0;
        if (applicant?.assignment?.slotId) {
          transaction.delete(doc(
            db,
            'interviewAssignmentLocks',
            getAssignmentLockId(roundId, applicant.assignment),
          ));
        }
          transaction.update(ref, {
          assignment: null,
          previousAssignment: applicant?.assignment ?? null,
          assignmentRevision: currentRevision + 1,
          updatedAt: serverTimestamp(),
          });
          if (applicant) {
            if (applicant.applicant.accessToken) transaction.update(doc(db, 'interviewAccess', applicant.applicant.accessToken), { assignmentSummary: null });
            transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
              roundId,
              applicantId: item.applicantId,
              type: 'unassigned',
              previousAssignment: applicant.assignment ?? null,
              nextAssignment: null,
              previousRevision: currentRevision,
              nextRevision: currentRevision + 1,
              reason: '회차 일정 설정 변경',
              createdAt: serverTimestamp(),
              createdBy: actorEmail(),
            });
          }
      }
    });
    return {
      cleanedResponseCount: affected.length,
      clearedAssignmentCount: assignmentImpact.affectedAssignmentCount,
    };
  });
}


export async function resetInterviewApplicantSchedule(applicantId: string): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) {
      throw new Error('지원 철회 또는 보관된 지원자는 정상 상태로 복구한 뒤 일정을 초기화할 수 있습니다.');
    }
    const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
    const accessSnapshot = await transaction.get(accessRef);
    if (!accessSnapshot.exists()) throw new Error('지원자의 공개 링크 정보를 찾을 수 없습니다.');
    const changeRequestRef = doc(db, 'interviewChangeRequests', applicant.accessToken);
    const changeRequestSnapshot = await transaction.get(changeRequestRef);
    const noteSnapshot = await transaction.get(doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`));
    const note = noteSnapshot.data() as InterviewNote | undefined;

    const transition = prepareScheduleResetTransition(applicant);
    const { previousAssignment, previousRevision, nextRevision } = transition;
    if (previousAssignment?.slotId) {
      transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, previousAssignment)));
    }
    transaction.update(applicantRef, {
      ...transition.applicantPatch,
      updatedAt: serverTimestamp(),
    });
    transaction.update(accessRef, {
      ...transition.accessPatch,
      ...(accessSnapshot.data().changeRequestStatus === 'open' ? { changeRequestStatus: 'resolved' } : {}),
    });
    if (changeRequestSnapshot.exists() && changeRequestSnapshot.data().status === 'open') {
      transaction.update(changeRequestRef, {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: actorEmail(),
      });
    }
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'schedule_reset',
      previousAssignment,
      nextAssignment: null,
      previousRevision,
      nextRevision,
      reason: '일정 초기화',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    if (hasInterviewRecord(applicant, note)) {
      transaction.set(doc(collection(db, 'interviewRecordEvents')), {
        roundId: applicant.roundId,
        applicantId,
        type: 'schedule_reset_snapshot',
        ...interviewRecordSnapshot(applicant, note),
        reason: '일정 초기화 전 기록 보존',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    }
  });
}

export async function setInterviewApplicantWithdrawn(applicantId: string, withdrawn: boolean): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const accessRef = doc(db, 'interviewAccess', applicant.accessToken);
    const accessSnapshot = await transaction.get(accessRef);
    if (!accessSnapshot.exists()) throw new Error('지원자의 공개 링크 정보를 찾을 수 없습니다.');
    const changeRequestRef = doc(db, 'interviewChangeRequests', applicant.accessToken);
    const changeRequestSnapshot = await transaction.get(changeRequestRef);
    const noteSnapshot = await transaction.get(doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`));
    const note = noteSnapshot.data() as InterviewNote | undefined;

    const wasWithdrawn = (applicant.applicationStatus ?? 'active') === 'withdrawn';
    if (wasWithdrawn === withdrawn) return;
    const transition = prepareWithdrawalTransition(applicant, withdrawn);
    const { activeAssignment, previousRevision, nextRevision } = transition;
    if (withdrawn && activeAssignment?.slotId) {
      transaction.delete(doc(db, 'interviewAssignmentLocks', getAssignmentLockId(applicant.roundId, activeAssignment)));
    }
    transaction.update(applicantRef, {
      ...transition.applicantPatch,
      withdrawnAt: withdrawn ? serverTimestamp() : null,
      withdrawnBy: withdrawn ? actorEmail() : null,
      updatedAt: serverTimestamp(),
    });
    transaction.update(accessRef, {
      ...transition.accessPatch,
      ...(accessSnapshot.data().changeRequestStatus === 'open' ? { changeRequestStatus: 'dismissed' } : {}),
    });
    if (changeRequestSnapshot.exists() && changeRequestSnapshot.data().status === 'open') {
      transaction.update(changeRequestRef, {
        status: 'dismissed',
        resolvedAt: serverTimestamp(),
        resolvedBy: actorEmail(),
      });
    }
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: withdrawn ? 'withdrawn' : 'restored',
      previousAssignment: withdrawn ? activeAssignment : null,
      nextAssignment: null,
      previousRevision,
      nextRevision,
      reason: withdrawn ? '지원 철회' : '지원 철회 취소',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    if (withdrawn && hasInterviewRecord(applicant, note)) {
      transaction.set(doc(collection(db, 'interviewRecordEvents')), {
        roundId: applicant.roundId,
        applicantId,
        type: 'withdrawal_snapshot',
        ...interviewRecordSnapshot(applicant, note),
        reason: '지원 철회 전 기록 보존',
        createdAt: serverTimestamp(),
        createdBy: actorEmail(),
      });
    }
  });
}
