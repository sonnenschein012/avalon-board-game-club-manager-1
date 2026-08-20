import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { InterviewAccess, InterviewApplicant, InterviewRound } from '../types';
import {
  createInterviewRound,
  subscribeAllInterviewAccess,
  subscribeAllInterviewApplicants,
  subscribeInterviewRounds,
  type InterviewRoundDraft,
} from '../services/interviewsService';

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
  const [saving, setSaving] = useState(false);

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
      const roundApplicants = applicants.filter(item => item.roundId === round.id);
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
    setSaving(true);
    try {
      await createInterviewRound(draft);
      toast.success('면접 회차가 생성되었습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('면접 회차를 저장하지 못했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { rounds, countsByRound, loading, saving, saveRound };
}
