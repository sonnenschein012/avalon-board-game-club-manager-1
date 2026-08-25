import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  OVERALL_RATINGS,
  prepareInterviewCompletion,
  prepareInterviewReopen,
} from '../../domain/interviews/interviewCompletion';
import { getInterviewProgressStatus } from '../../domain/interviews/interviewV3Policy';
import type {
  InterviewApplicant,
  InterviewNote,
  InterviewOverallRating,
  InterviewProgressStatus,
  InterviewSelectionStatus,
} from '../../types';
import type { CompleteInterviewInput } from './models';
import {
  actorEmail,
  currentAssignmentRevision,
  interviewRecordSnapshot,
  isActiveApplicant,
  isCurrentConfirmationSent,
} from './shared';

export function subscribeInterviewNote(
  roundId: string,
  applicantId: string,
  onData: (note: InterviewNote | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const noteId = `${roundId}__${applicantId}`;
  return onSnapshot(doc(db, 'interviewNotes', noteId), snapshot => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as InterviewNote) : null);
  }, onError);
}

export async function saveInterviewNote(input: {
  roundId: string;
  applicantId: string;
  interviewerId: string;
  interviewerName: string;
  generalNotes: string;
  answers: Record<string, string>;
  overallRating?: InterviewOverallRating | null;
}): Promise<void> {
  if (input.overallRating != null && !OVERALL_RATINGS.includes(input.overallRating)) {
    throw new Error('올바르지 않은 종합평가입니다.');
  }
  const noteRef = doc(db, 'interviewNotes', `${input.roundId}__${input.applicantId}`);
  const applicantRef = doc(db, 'interviewApplicants', input.applicantId);
  await runTransaction(db, async transaction => {
    const [noteSnapshot, applicantSnapshot] = await Promise.all([
      transaction.get(noteRef),
      transaction.get(applicantRef),
    ]);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (applicant.roundId !== input.roundId) throw new Error('다른 면접 회차의 지원자입니다.');
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자의 면접 기록은 수정할 수 없습니다.');
    // A pending autosave that races the final completion transaction must not
    // overwrite the rating and notes that were atomically finalized there.
    if (getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('완료된 면접의 평가는 선발 상세에서 수정해주세요.');
    }
    transaction.set(noteRef, {
      ...input,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    if ('overallRating' in input) {
      transaction.update(applicantRef, {
        overallRating: input.overallRating ?? null,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function updateCompletedInterviewOverallRating(
  applicantId: string,
  overallRating: InterviewOverallRating,
): Promise<void> {
  if (!OVERALL_RATINGS.includes(overallRating)) throw new Error('올바르지 않은 종합평가입니다.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자의 평가는 수정할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) !== 'completed') throw new Error('완료된 면접의 평가만 이곳에서 수정할 수 있습니다.');
    const noteRef = doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`);
    const noteSnapshot = await transaction.get(noteRef);
    const note = noteSnapshot.data() as InterviewNote | undefined;
    const assignment = applicant.assignment ?? applicant.previousAssignment;
    transaction.set(noteRef, {
      roundId: applicant.roundId,
      applicantId,
      interviewerId: note?.interviewerId ?? assignment?.interviewerId ?? '',
      interviewerName: note?.interviewerName ?? assignment?.interviewerName ?? '',
      generalNotes: note?.generalNotes ?? '',
      answers: note?.answers ?? {},
      overallRating,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    transaction.update(applicantRef, {
      overallRating,
      updatedAt: serverTimestamp(),
    });
    const previousOverallRating = note?.overallRating ?? applicant.overallRating ?? null;
    const updatedApplicant = { ...applicant, overallRating };
    const updatedNote = {
      ...(note ?? {}),
      interviewerId: note?.interviewerId ?? assignment?.interviewerId ?? '',
      interviewerName: note?.interviewerName ?? assignment?.interviewerName ?? '',
      generalNotes: note?.generalNotes ?? '',
      answers: note?.answers ?? {},
      overallRating,
    } as InterviewNote;
    transaction.set(doc(collection(db, 'interviewRecordEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'rating_changed',
      ...interviewRecordSnapshot(updatedApplicant, updatedNote),
      previousOverallRating,
      nextOverallRating: overallRating,
      reason: '면접 완료 후 종합평가 정정',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function setInterviewActionNeeded(applicantId: string, reason = ''): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 처리할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) === 'completed') {
      throw new Error('이미 완료된 면접은 조치 필요로 변경할 수 없습니다.');
    }
    transaction.update(applicantRef, {
      interviewStatus: 'action_needed' satisfies InterviewProgressStatus,
      actionNeededReason: reason.trim().slice(0, 500) || null,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function restoreScheduledInterview(applicantId: string): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 처리할 수 없습니다.');
    if (!applicant.assignment) throw new Error('현재 면접 배정이 없습니다.');
    if (getInterviewProgressStatus(applicant) === 'completed') throw new Error('이미 완료된 면접입니다.');
    const restoredAssignment = {
      ...applicant.assignment,
      status: isCurrentConfirmationSent(applicant) ? 'confirmed' as const : 'scheduled' as const,
    };
    transaction.update(applicantRef, {
      assignment: restoredAssignment,
      interviewStatus: 'scheduled' satisfies InterviewProgressStatus,
      actionNeededReason: null,
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': restoredAssignment.status,
    });
  });
}

export async function completeInterviewAtomically(input: CompleteInterviewInput): Promise<void> {
  const applicantId = input.applicantId?.trim();
  const roundId = input.roundId?.trim();
  if (!applicantId || !roundId) throw new Error('지원자 정보를 확인하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  const noteRef = doc(db, 'interviewNotes', `${roundId}__${applicantId}`);
  await runTransaction(db, async transaction => {
    const [applicantSnapshot, noteSnapshot] = await Promise.all([
      transaction.get(applicantRef),
      transaction.get(noteRef),
    ]);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const existingNote = noteSnapshot.data() as InterviewNote | undefined;
    const completion = prepareInterviewCompletion(applicant, existingNote ?? null, { ...input, roundId });

    transaction.set(noteRef, {
      roundId,
      applicantId,
      interviewerId: completion.interviewerId,
      interviewerName: completion.interviewerName,
      generalNotes: completion.generalNotes,
      answers: completion.answers,
      overallRating: completion.overallRating,
      ...(noteSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      updatedBy: actorEmail(),
    }, { merge: true });
    transaction.update(applicantRef, {
      assignment: completion.completedAssignment,
      interviewStatus: 'completed' satisfies InterviewProgressStatus,
      actionNeededReason: null,
      overallRating: completion.overallRating,
      interviewCompletedAt: serverTimestamp(),
      interviewCompletedBy: actorEmail(),
      selectionStatus: applicant.selectionStatus ?? 'pending',
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': 'completed',
    });
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'status_changed',
      previousAssignment: applicant.assignment,
      nextAssignment: completion.completedAssignment,
      previousRevision: currentAssignmentRevision(applicant),
      nextRevision: currentAssignmentRevision(applicant),
      reason: '면접 완료',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    const completedApplicant = {
      ...applicant,
      assignment: completion.completedAssignment,
      interviewStatus: 'completed' as const,
      overallRating: completion.overallRating,
    };
    const completedNote = {
      ...(existingNote ?? {}),
      interviewerId: completion.interviewerId,
      interviewerName: completion.interviewerName,
      generalNotes: completion.generalNotes,
      answers: completion.answers,
      overallRating: completion.overallRating,
    } as InterviewNote;
    transaction.set(doc(collection(db, 'interviewRecordEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'completed',
      ...interviewRecordSnapshot(completedApplicant, completedNote),
      reason: '면접 완료 시점 기록',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

/**
 * Reopens a completed interview in one transaction. The notes and rating stay
 * intact, while completion/selection metadata returns to the pre-decision
 * workflow state. A record-event snapshot preserves the completed state.
 */
export async function reopenCompletedInterview(applicantId: string): Promise<void> {
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const applicantSnapshot = await transaction.get(applicantRef);
    if (!applicantSnapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = applicantSnapshot.data() as InterviewApplicant;
    const noteRef = doc(db, 'interviewNotes', `${applicant.roundId}__${applicantId}`);
    const noteSnapshot = await transaction.get(noteRef);
    const note = noteSnapshot.data() as InterviewNote | undefined;
    const { reopenedAssignment } = prepareInterviewReopen(applicant, isCurrentConfirmationSent(applicant));
    const previousRevision = currentAssignmentRevision(applicant);

    transaction.update(applicantRef, {
      assignment: reopenedAssignment,
      interviewStatus: 'scheduled' satisfies InterviewProgressStatus,
      actionNeededReason: null,
      interviewCompletedAt: null,
      interviewCompletedBy: null,
      selectionStatus: 'pending' satisfies InterviewSelectionStatus,
      selectionDecidedAt: null,
      selectionDecidedBy: null,
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'interviewAccess', applicant.accessToken), {
      'assignmentSummary.status': reopenedAssignment.status,
    });
    transaction.set(doc(collection(db, 'interviewAssignmentEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'status_changed',
      previousAssignment: applicant.assignment,
      nextAssignment: reopenedAssignment,
      previousRevision,
      nextRevision: previousRevision,
      reason: '면접 완료 취소',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
    transaction.set(doc(collection(db, 'interviewRecordEvents')), {
      roundId: applicant.roundId,
      applicantId,
      type: 'reopened',
      ...interviewRecordSnapshot(applicant, note),
      previousSelectionStatus: applicant.selectionStatus ?? 'pending',
      reason: '면접 완료 취소 전 기록 보존',
      createdAt: serverTimestamp(),
      createdBy: actorEmail(),
    });
  });
}

export async function updateInterviewSelectionStatus(
  applicantId: string,
  selectionStatus: InterviewSelectionStatus,
): Promise<void> {
  const allowed: InterviewSelectionStatus[] = ['pending', 'selected', 'rejected'];
  if (!allowed.includes(selectionStatus)) throw new Error('올바르지 않은 선발 상태입니다.');
  const applicantRef = doc(db, 'interviewApplicants', applicantId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(applicantRef);
    if (!snapshot.exists()) throw new Error('지원자를 찾을 수 없습니다.');
    const applicant = snapshot.data() as InterviewApplicant;
    if (!isActiveApplicant(applicant)) throw new Error('지원 철회 또는 보관된 지원자는 선발 대상으로 처리할 수 없습니다.');
    if (getInterviewProgressStatus(applicant) !== 'completed') {
      throw new Error('면접 완료자만 선발 상태를 변경할 수 있습니다.');
    }
    transaction.update(applicantRef, {
      selectionStatus,
      selectionDecidedAt: selectionStatus === 'pending' ? null : serverTimestamp(),
      selectionDecidedBy: selectionStatus === 'pending' ? null : actorEmail(),
      updatedAt: serverTimestamp(),
    });
  });
}
