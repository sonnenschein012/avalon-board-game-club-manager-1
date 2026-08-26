import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { InterviewAccess, InterviewApplicant, InterviewRound } from '../types';
import { isActiveInterviewApplicant } from '../domain/interviews/interviewV3Policy';
import {
  createInterviewRound,
  deleteInterviewRound,
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
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);

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

  const removeRound = async (round: InterviewRound) => {
    if (deletingRoundId) return false;
    setDeletingRoundId(round.id);
    try {
      const result = await deleteInterviewRound(round.id);
      toast.success(`${round.name} 회차와 관련 데이터 ${result.deletedDocuments}건을 삭제했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 회차를 삭제하지 못했습니다.');
      return false;
    } finally {
      setDeletingRoundId(null);
    }
  };

  return { rounds, countsByRound, loading, saving, saveRound, deletingRoundId, removeRound };
}
