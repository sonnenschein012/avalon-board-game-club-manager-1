import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import type { InterviewAccess, InterviewApplicant, InterviewAssignment, InterviewRound } from '../types';
import {
  aggregateAvailability as aggregateAvailabilityResponses,
  assignmentsOverlap,
  availabilityToAssignmentCandidates,
  getAssignmentScheduleImpact,
  getScheduleChangeImpact,
  parseSlotId,
} from '../domain/interviews/scheduling';
import {
  applyInterviewScheduleChange,
  getInterviewLink,
  getInterviewRound,
  importInterviewApplicants,
  markInterviewMessageSent,
  saveInterviewAssignment,
  subscribeInterviewAccess,
  subscribeInterviewApplicants,
  type ApplicantImportRow,
  type InterviewApplicantWithAccess,
  type InterviewRoundDraft,
} from '../services/interviewsService';

export type InterviewApplicantFilter =
  | 'all'
  | 'responded'
  | 'pending'
  | 'assigned'
  | 'unassigned'
  | 'availability-unsent'
  | 'availability-sent'
  | 'availability-sent-pending'
  | 'confirmation-unsent'
  | 'confirmation-sent';

export function useInterviewRoundLogic(roundId: string) {
  const [round, setRound] = useState<InterviewRound | null>(null);
  const [applicants, setApplicants] = useState<InterviewApplicant[]>([]);
  const [access, setAccess] = useState<InterviewAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InterviewApplicantFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    getInterviewRound(roundId).then(value => {
      if (alive) { setRound(value); setLoading(false); }
    }).catch(error => {
      console.error(error);
      toast.error('면접 회차를 불러오지 못했습니다.');
      if (alive) setLoading(false);
    });
    const stopApplicants = subscribeInterviewApplicants(roundId, setApplicants, console.error);
    const stopAccess = subscribeInterviewAccess(roundId, setAccess, console.error);
    return () => { alive = false; stopApplicants(); stopAccess(); };
  }, [roundId]);

  const joinedApplicants = useMemo<InterviewApplicantWithAccess[]>(() => {
    const accessByApplicant = new Map(access.map(item => [item.applicantId, item]));
    return applicants.map(applicant => ({
      ...applicant,
      access: accessByApplicant.get(applicant.id) ?? null,
      link: getInterviewLink(applicant.accessToken),
    }));
  }, [access, applicants]);

  const filteredApplicants = useMemo(() => joinedApplicants.filter(applicant => {
    const q = search.trim().toLowerCase();
    if (q && !`${applicant.applicantNumber} ${applicant.name} ${applicant.phone}`.toLowerCase().includes(q)) return false;
    const responded = Boolean(applicant.access?.submittedAt);
    const availabilitySent = Boolean(applicant.availabilityMessage.firstMarkedSentAt);
    const confirmationSent = Boolean(applicant.confirmationMessage.firstMarkedSentAt);
    if (filter === 'responded') return responded;
    if (filter === 'pending') return !responded;
    if (filter === 'assigned') return Boolean(applicant.assignment);
    if (filter === 'unassigned') return !applicant.assignment;
    if (filter === 'availability-unsent') return !availabilitySent;
    if (filter === 'availability-sent') return availabilitySent;
    if (filter === 'availability-sent-pending') return availabilitySent && !responded;
    const confirmationMatchesAssignment = Boolean(applicant.assignment) && confirmationSent
      && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0) === (applicant.confirmationMessage.assignmentRevision ?? 0);
    if (filter === 'confirmation-unsent') return Boolean(applicant.assignment) && !confirmationMatchesAssignment;
    if (filter === 'confirmation-sent') return confirmationMatchesAssignment;
    return true;
  }), [filter, joinedApplicants, search]);

  const aggregateAvailability = useMemo(() => {
    const applicantsById = new Map(joinedApplicants.map(applicant => [applicant.id, applicant]));
    const result: Record<string, InterviewApplicantWithAccess[]> = {};
    round?.allowedSlots.forEach(slot => { result[slot] = []; });
    aggregateAvailabilityResponses(access).forEach(cell => {
      if (!result[cell.slotId]) return;
      result[cell.slotId] = cell.applicantIds
        .map(applicantId => applicantsById.get(applicantId))
        .filter((applicant): applicant is InterviewApplicantWithAccess => Boolean(applicant));
    });
    return result;
  }, [access, joinedApplicants, round]);

  const importRows = async (rows: ApplicantImportRow[]) => {
    const existingNumbers = new Set(applicants.map(applicant => applicant.applicantNumber.trim()));
    const duplicates = rows.filter(row => existingNumbers.has(row.applicantNumber.trim()));
    if (duplicates.length > 0) {
      const examples = duplicates.slice(0, 5).map(row => row.applicantNumber).join(', ');
      toast.error(`이미 등록된 지원번호가 있습니다: ${examples}${duplicates.length > 5 ? ' 외' : ''}`);
      return false;
    }
    try {
      const count = await importInterviewApplicants(roundId, rows);
      toast.success(`${count}명의 지원자를 등록했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error('지원자 등록에 실패했습니다.');
      return false;
    }
  };

  const markSent = async (
    applicantId: string,
    kind: 'availabilityMessage' | 'reminderMessage' | 'confirmationMessage',
    markedSent: boolean,
  ) => {
    try {
      const applicant = applicants.find(item => item.id === applicantId);
      if (!applicant) throw new Error('지원자를 찾을 수 없습니다.');
      await markInterviewMessageSent(applicantId, kind, markedSent);
      toast.success(markedSent ? '발송 표시를 기록했습니다.' : '발송 표시를 취소했습니다.');
    } catch (error) {
      console.error(error);
      toast.error('발송 표시를 변경하지 못했습니다.');
    }
  };

  const assignmentFromSlot = (slot: string): InterviewAssignment | null => {
    if (!round) return null;
    const parsed = parseSlotId(slot);
    if (!parsed) return null;
    return {
      slotId: slot,
      startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
      durationMinutes: round.assignmentSlotMinutes,
      interviewerId: 'default',
    };
  };

  const getAssignmentConflict = (slot: string, applicantId: string) => {
    const assignment = assignmentFromSlot(slot);
    if (!assignment) return null;
    return joinedApplicants.find(other => (
      other.id !== applicantId
      && Boolean(other.assignment)
      && assignmentsOverlap(assignment, other.assignment!)
    )) ?? null;
  };

  const assignApplicant = async (applicant: InterviewApplicantWithAccess, slot: string) => {
    if (!round) return false;
    const candidates = availabilityToAssignmentCandidates(
      applicant.access?.availability ?? [],
      round.availabilitySlotMinutes,
      round.assignmentSlotMinutes,
    );
    if (!candidates.includes(slot)) {
      toast.error('지원자가 선택하지 않은 시간입니다.');
      return false;
    }
    const assignment = assignmentFromSlot(slot);
    if (!assignment) {
      toast.error('올바르지 않은 면접 시간입니다.');
      return false;
    }
    const conflict = getAssignmentConflict(slot, applicant.id);
    if (conflict) {
      toast.error(`기본 면접관 일정이 ${conflict.name} 지원자와 겹칩니다.`);
      return false;
    }
    try {
      await saveInterviewAssignment(applicant.id, assignment);
      const notice = applicant.confirmationMessage.firstMarkedSentAt
        ? ' 기존 확정 안내는 이전 시간 기준이므로 새 문자를 다시 보내주세요.'
        : '';
      toast.success(`${applicant.name} 지원자의 면접 시간을 배정했습니다.${notice}`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error && error.message.includes('이미 배정')
        ? error.message
        : '면접 시간을 저장하지 못했습니다.');
      return false;
    }
  };

  const clearAssignment = async (applicantId: string) => {
    try {
      const applicant = joinedApplicants.find(item => item.id === applicantId);
      await saveInterviewAssignment(applicantId, null);
      const notice = applicant?.confirmationMessage.firstMarkedSentAt
        ? ' 이전 확정 안내 기록은 이력으로 남아 있습니다.'
        : '';
      toast.success(`배정을 해제했습니다.${notice}`);
    } catch (error) {
      console.error(error);
      toast.error('배정을 해제하지 못했습니다.');
    }
  };

  const previewScheduleImpact = (draft: InterviewRoundDraft) => {
    const responseImpact = !round ? {
      addedAllowedSlots: [],
      removedAllowedSlots: [],
      affectedResponseCount: 0,
      removedSelectionCount: 0,
      affectedResponses: [],
    } : getScheduleChangeImpact(round.allowedSlots, draft.allowedSlots, access);
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      joinedApplicants.map(item => ({ applicantId: item.id, assignment: item.assignment })),
    );
    return { ...responseImpact, ...assignmentImpact };
  };

  const applySchedule = async (draft: InterviewRoundDraft) => {
    try {
      const impacted = await applyInterviewScheduleChange(
        roundId,
        draft,
        access.map(item => item.id),
        joinedApplicants.map(item => item.id),
      );
      setRound(current => current ? {
        ...current,
        ...draft,
        surveyOpensAt: Timestamp.fromDate(draft.surveyOpensAt),
        surveyClosesAt: Timestamp.fromDate(draft.surveyClosesAt),
      } : current);
      const summaries = [
        impacted.cleanedResponseCount ? `${impacted.cleanedResponseCount}명의 무효 응답 정리` : '',
        impacted.clearedAssignmentCount ? `${impacted.clearedAssignmentCount}명의 기존 배정 해제` : '',
      ].filter(Boolean).join(' · ');
      toast.success(`일정을 저장했습니다${summaries ? ` · ${summaries}` : ''}.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error('회차 설정을 저장하지 못했습니다.');
      return false;
    }
  };

  return {
    round,
    applicants: joinedApplicants,
    filteredApplicants,
    access,
    aggregateAvailability,
    loading,
    filter,
    setFilter,
    search,
    setSearch,
    importRows,
    markSent,
    getAssignmentConflict,
    assignApplicant,
    clearAssignment,
    previewScheduleImpact,
    applySchedule,
  };
}
