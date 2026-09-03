import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { InterviewAccess, InterviewApplicant, InterviewRound } from '../types';
import { isActiveInterviewApplicant } from '../domain/interviews/interviewPolicy';
import {
  createInterviewRound,
  subscribeAllInterviewAccess,
  subscribeAllInterviewApplicants,
  subscribeInterviewRounds,
  type InterviewRoundDraft,
} from '../services/interviewsService';
import { useAsyncActionState } from './useAsyncActionState';

export interface InterviewRoundCounts {
  total: number;
  responded: number;
  pending: number;
}

export function useInterviewRoundsLogic() {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [applicants, setApplicants] = useState<InterviewApplicant[]>([]);
  const [access, setAccess] = useState<InterviewAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const { runAction, isPending } = useAsyncActionState();
  const saving = isPending('interview-round-save');

  useEffect(() => {
    const stopRounds = subscribeInterviewRounds(
      value => { setRounds(value); setLoading(false); },
      error => { console.error(error); toast.error('면접 회차를 불러오지 못했습니다.'); setLoading(false); },
    );
    // Two collection listeners provide realtime counts for every round without N listeners per round.
    const stopApplicants = subscribeAllInterviewApplicants(setApplicants, console.error);
    const stopAccess = subscribeAllInterviewAccess(setAccess, console.error);
    return () => {
      stopRounds();
      stopApplicants();
      stopAccess();
    };
  }, []);

  const countsByRound = useMemo(() => {
    const result: Record<string, InterviewRoundCounts> = {};
    rounds.forEach(round => {
      // All user-facing round counts use the same active-applicant population.
      // Archived and withdrawn records remain queryable as history but must not
      // inflate the operational response totals.
      const roundApplicants = applicants.filter(item => item.roundId === round.id && isActiveInterviewApplicant(item));
      const submittedApplicantIds = new Set(
        access.filter(item => item.roundId === round.id && item.submittedAt).map(item => item.applicantId),
      );
      result[round.id] = {
        total: roundApplicants.length,
        responded: roundApplicants.filter(item => submittedApplicantIds.has(item.id)).length,
        pending: roundApplicants.filter(item => !submittedApplicantIds.has(item.id)).length,
      };
    });
    return result;
  }, [access, applicants, rounds]);

  const saveRound = async (draft: InterviewRoundDraft) => {
    if (saving) return false;
    const result = await runAction('interview-round-save', () => createInterviewRound(draft), {
      successMessage: '면접 회차가 생성되었습니다.',
      errorMessage: '면접 회차를 저장하지 못했습니다.',
      onError: console.error,
    });
    return result.succeeded;
  };

  return { rounds, countsByRound, loading, saving, saveRound };
}
