import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { InterviewAccess, InterviewPublicRound, InterviewPublicSchedule } from '../types';

export interface PublicInterviewSnapshot {
  access: InterviewAccess | null;
  round: InterviewPublicRound | InterviewPublicSchedule | null;
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
  let currentRound: InterviewPublicRound | InterviewPublicSchedule | null = null;
  let currentRoundKey: string | null = null;
  let hasReceivedRoundSnapshot = false;

  const clearRoundSubscription = () => {
    roundUnsubscribe?.();
    roundUnsubscribe = null;
    currentRound = null;
    currentRoundKey = null;
    hasReceivedRoundSnapshot = false;
  };

  const accessUnsubscribe = onSnapshot(
    doc(db, 'interviewAccess', token),
    (accessSnapshot) => {
      if (!accessSnapshot.exists()) {
        clearRoundSubscription();
        currentAccess = null;
        onValue({ access: null, round: null });
        return;
      }

      currentAccess = { id: accessSnapshot.id, ...accessSnapshot.data() } as InterviewAccess;
      const access = currentAccess;
      if (!access.active) {
        clearRoundSubscription();
        onValue({ access, round: null });
        return;
      }
      // New applicants explicitly have no schedule yet. Do not fetch the
      // legacy round document; the public UI can show its waiting state from
      // the access record alone.
      if (access.scheduleId === null) {
        clearRoundSubscription();
        onValue({ access, round: null });
        return;
      }

      const publicCollection = access.scheduleId ? 'interviewPublicSchedules' : 'interviewPublicRounds';
      const publicDocumentId = access.scheduleId ?? access.roundId;
      const nextRoundKey = `${publicCollection}/${publicDocumentId}`;
      if (currentRoundKey === nextRoundKey) {
        // Access updates (first visit, response save) must be visible
        // immediately without tearing down and recreating the round listener.
        if (hasReceivedRoundSnapshot) onValue({ access, round: currentRound });
        return;
      }
      clearRoundSubscription();
      currentRoundKey = nextRoundKey;
      roundUnsubscribe = onSnapshot(
        doc(db, publicCollection, publicDocumentId),
        (roundSnapshot) => {
          hasReceivedRoundSnapshot = true;
          const latestAccess = currentAccess;
          if (!latestAccess) return;
          const round = roundSnapshot.exists()
            ? ({ id: roundSnapshot.id, ...roundSnapshot.data() } as InterviewPublicRound | InterviewPublicSchedule)
            : null;
          currentRound = round;
          onValue({ access: latestAccess, round });
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `${publicCollection}/${publicDocumentId}`);
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
    clearRoundSubscription();
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
