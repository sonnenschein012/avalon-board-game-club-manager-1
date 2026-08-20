import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { InterviewAccess, InterviewPublicRound } from '../types';

export interface PublicInterviewSnapshot {
  access: InterviewAccess | null;
  round: InterviewPublicRound | null;
}

export async function initializePublicInterviewAccess(token: string): Promise<void> {
  const accessRef = doc(db, 'interviewAccess', token);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(accessRef);
    if (!snapshot.exists()) throw new Error('면접 링크를 찾을 수 없습니다.');
    const access = snapshot.data() as InterviewAccess;
    if (!access.active) throw new Error('비활성화된 면접 링크입니다.');

    // Spark 요금제에서는 별도 서버 함수를 둘 수 없으므로, Firestore의
    // request.time(= serverTimestamp)로 최초 접속 시각을 한 번만 기록한다.
    // 보안 규칙이 재기록과 임의 시각 입력을 막는다.
    if (access.firstAccessedAt == null) {
      transaction.update(accessRef, { firstAccessedAt: serverTimestamp() });
    }
  });
}

export function subscribeToPublicInterview(
  token: string,
  onValue: (value: PublicInterviewSnapshot) => void,
  onError: (error: Error) => void,
) {
  let roundUnsubscribe: (() => void) | null = null;
  let currentAccess: InterviewAccess | null = null;

  const accessUnsubscribe = onSnapshot(
    doc(db, 'interviewAccess', token),
    (accessSnapshot) => {
      roundUnsubscribe?.();
      roundUnsubscribe = null;

      if (!accessSnapshot.exists()) {
        currentAccess = null;
        onValue({ access: null, round: null });
        return;
      }

      currentAccess = { id: accessSnapshot.id, ...accessSnapshot.data() } as InterviewAccess;
      const access = currentAccess;
      if (!access.active) {
        onValue({ access, round: null });
        return;
      }

      roundUnsubscribe = onSnapshot(
        doc(db, 'interviewPublicRounds', access.roundId),
        (roundSnapshot) => {
          const latestAccess = currentAccess;
          if (!latestAccess) return;
          const round = roundSnapshot.exists()
            ? ({ id: roundSnapshot.id, ...roundSnapshot.data() } as InterviewPublicRound)
            : null;
          onValue({ access: latestAccess, round });
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `interviewPublicRounds/${access.roundId}`);
          onError(error);
        },
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'interviewAccess/[redacted]');
      onError(error);
    },
  );

  return () => {
    roundUnsubscribe?.();
    accessUnsubscribe();
  };
}

export async function savePublicAvailability(token: string, availability: string[], isFirstSubmission: boolean) {
  try {
    const accessRef = doc(db, 'interviewAccess', token);
    if (isFirstSubmission) {
      await updateDoc(accessRef, {
        availability,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responseUpdatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(accessRef, {
        availability,
        updatedAt: serverTimestamp(),
        responseUpdatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'interviewAccess/[redacted]');
    throw error;
  }
}

export async function requestPublicInterviewChange(token: string, access: InterviewAccess, reason: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'interviewChangeRequests', token), {
    roundId: access.roundId,
    applicantId: access.applicantId,
    applicantName: access.displayName,
    status: 'open',
    reason: reason.trim().slice(0, 500),
    requestedAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });
  batch.update(doc(db, 'interviewAccess', token), { changeRequestStatus: 'open' });
  await batch.commit();
}
