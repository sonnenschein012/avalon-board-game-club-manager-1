import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { InterviewAccess, InterviewPublicRound } from '../types';

export interface PublicInterviewSnapshot {
  access: InterviewAccess | null;
  round: InterviewPublicRound | null;
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
