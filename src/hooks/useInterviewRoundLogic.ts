import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import type { InterviewAccess, InterviewApplicant, InterviewAssignment, InterviewChangeRequest, InterviewRound, InterviewRoundInterviewer } from '../types';
import {
  aggregateAvailability as aggregateAvailabilityResponses,
  assignmentsOverlap,
  availabilityToAssignmentCandidates,
  getAssignmentScheduleImpact,
  getScheduleChangeImpact,
  parseSlotId,
} from '../domain/interviews/scheduling';
import {
  addRoundInterviewer,
  applyInterviewAssignmentProposals,
  applyInterviewScheduleChange,
  createInterviewApplicant,
  getInterviewLink,
  markInterviewMessageSent,
  mergeInterviewApplicants,
  removeRoundInterviewer,
  resolveInterviewChangeRequest,
  saveInterviewAssignment,
  setInterviewApplicantArchived,
  subscribeInterviewAccess,
  subscribeInterviewApplicants,
  subscribeInterviewChangeRequests,
  subscribeInterviewRound,
  subscribeRoundInterviewers,
  updateInterviewApplicant,
  updateInterviewAssignmentState,
  updateRoundInterviewerAvailability,
  type ApplicantDraft,
  type ApplicantImportRow,
  type InterviewApplicantWithAccess,
  type InterviewRoundDraft,
} from '../services/interviewsService';
import { previewApplicantMerge } from '../domain/interviews/applicantMerge';
import { generateAutoAssignment, type AutoAssignmentMode, type AutoAssignmentResult } from '../domain/interviews/autoAssignment';

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
  | 'confirmation-sent'
  | 'archived';

export function useInterviewRoundLogic(roundId: string) {
  const [round, setRound] = useState<InterviewRound | null>(null);
  const [applicants, setApplicants] = useState<InterviewApplicant[]>([]);
  const [access, setAccess] = useState<InterviewAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<InterviewRoundInterviewer[]>([]);
  const [changeRequests, setChangeRequests] = useState<InterviewChangeRequest[]>([]);
  const [autoDraft, setAutoDraft] = useState<AutoAssignmentResult | null>(null);
  const [filter, setFilter] = useState<InterviewApplicantFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stopRound = subscribeInterviewRound(roundId, value => { setRound(value); setLoading(false); }, error => {
      console.error(error); toast.error('면접 회차를 불러오지 못했습니다.'); setLoading(false);
    });
    const stopApplicants = subscribeInterviewApplicants(roundId, setApplicants, console.error);
    const stopAccess = subscribeInterviewAccess(roundId, setAccess, console.error);
    const stopInterviewers = subscribeRoundInterviewers(roundId, setInterviewers, console.error);
    const stopRequests = subscribeInterviewChangeRequests(roundId, setChangeRequests, console.error);
    return () => { stopRound(); stopApplicants(); stopAccess(); stopInterviewers(); stopRequests(); };
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
    const lifecycle = applicant.lifecycle ?? 'active';
    if (filter === 'archived') return lifecycle === 'archived';
    if (lifecycle === 'archived') return false;
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

  const previewImportRows = (rows: ApplicantImportRow[]) => previewApplicantMerge(
    applicants.map(applicant => ({
      id: applicant.id, applicantNumber: applicant.applicantNumber, name: applicant.name, phone: applicant.phone,
      applicationData: applicant.applicationData, accessToken: applicant.accessToken,
    })), rows,
  );

  const importRows = async (rows: ApplicantImportRow[]) => {
    const preview = previewImportRows(rows);
    if (preview.counts.review > 0) { toast.error('확인이 필요한 행을 먼저 수정해주세요.'); return false; }
    try {
      const result = await mergeInterviewApplicants(roundId, preview.items.flatMap(item => {
        if (item.action !== 'create' && item.action !== 'update') return [];
        return [{ ...item.row, action: item.action, ...(item.existing ? { existingId: item.existing.id } : {}) }];
      }));
      toast.success(`신규 ${result.created}명 · 업데이트 ${result.updated}명을 반영했습니다.`);
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

  const assignmentFromSlot = (slot: string, interviewer: InterviewRoundInterviewer, source: 'manual' | 'automatic' = 'manual'): InterviewAssignment | null => {
    if (!round) return null;
    const parsed = parseSlotId(slot);
    if (!parsed) return null;
    return {
      slotId: slot,
      startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
      durationMinutes: round.assignmentSlotMinutes,
      interviewerId: interviewer.interviewerId,
      interviewerName: interviewer.displayName,
      status: 'scheduled',
      locked: source === 'manual',
      source,
    };
  };

  const getAssignmentConflict = (slot: string, applicantId: string, interviewerId: string) => {
    const interviewer = interviewers.find(item => item.interviewerId === interviewerId);
    const assignment = interviewer ? assignmentFromSlot(slot, interviewer) : null;
    if (!assignment) return null;
    return joinedApplicants.find(other => (
      other.id !== applicantId
      && Boolean(other.assignment)
      && !['no_show', 'cancelled', 'needs_reschedule'].includes(other.assignment!.status)
      && assignmentsOverlap(assignment, other.assignment!)
    )) ?? null;
  };

  const assignApplicant = async (applicant: InterviewApplicantWithAccess, slot: string, interviewerId: string, lock = true) => {
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
    const interviewer = interviewers.find(item => item.interviewerId === interviewerId && item.active);
    if (!interviewer) { toast.error('면접관을 선택해주세요.'); return false; }
    const interviewerCandidates = availabilityToAssignmentCandidates(interviewer.availability, round.availabilitySlotMinutes, round.assignmentSlotMinutes);
    if (!interviewerCandidates.includes(slot)) { toast.error('면접관이 가능하다고 등록하지 않은 시간입니다.'); return false; }
    const assignment = assignmentFromSlot(slot, interviewer);
    if (!assignment) {
      toast.error('올바르지 않은 면접 시간입니다.');
      return false;
    }
    assignment.locked = lock;
    const conflict = getAssignmentConflict(slot, applicant.id, interviewerId);
    if (conflict) {
      toast.error(`${interviewer.displayName} 면접관 일정이 ${conflict.name} 지원자와 겹칩니다.`);
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

  const addApplicant = async (draft: ApplicantDraft) => {
    try { await createInterviewApplicant(roundId, draft); toast.success('지원자를 추가했습니다.'); return true; }
    catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : '지원자를 추가하지 못했습니다.'); return false; }
  };

  const editApplicant = async (applicant: InterviewApplicantWithAccess, draft: ApplicantDraft) => {
    try { await updateInterviewApplicant(applicant, draft); toast.success('지원자 정보를 수정했습니다.'); return true; }
    catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : '지원자 정보를 수정하지 못했습니다.'); return false; }
  };

  const archiveApplicant = async (applicant: InterviewApplicantWithAccess, archived: boolean) => {
    try { await setInterviewApplicantArchived(applicant, archived); toast.success(archived ? '지원자를 보관 처리했습니다.' : '지원자를 복원했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('지원자 상태를 바꾸지 못했습니다.'); return false; }
  };

  const addInterviewer = async (name: string, email?: string) => {
    try { await addRoundInterviewer(roundId, { name, ...(email ? { email } : {}) }); toast.success('면접관을 추가했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접관을 추가하지 못했습니다.'); return false; }
  };

  const saveInterviewerAvailability = async (participantId: string, availability: string[]) => {
    try { await updateRoundInterviewerAvailability(participantId, availability); toast.success('면접관 가능시간을 저장했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접관 가능시간을 저장하지 못했습니다.'); return false; }
  };

  const removeInterviewer = async (participant: InterviewRoundInterviewer) => {
    if (joinedApplicants.some(applicant => applicant.assignment?.interviewerId === participant.interviewerId)) {
      toast.error('배정된 지원자가 있는 면접관은 먼저 일정을 변경해야 합니다.'); return false;
    }
    await removeRoundInterviewer(participant); toast.success('회차에서 면접관을 제외했습니다.'); return true;
  };

  const runAutoAssignment = (mode: AutoAssignmentMode, applicantId?: string) => {
    if (!round) return null;
    const result = generateAutoAssignment({
      applicants: joinedApplicants.map(applicant => ({
        id: applicant.id, name: applicant.name, availability: applicant.access?.availability ?? [],
        lifecycle: applicant.lifecycle ?? 'active',
        existingAssignment: applicant.assignment?.slotId ? {
          slotId: applicant.assignment.slotId, interviewerId: applicant.assignment.interviewerId,
          interviewerName: applicant.assignment.interviewerName, locked: applicant.assignment.locked,
          source: applicant.assignment.source, status: applicant.assignment.status,
        } : null,
      })),
      interviewers: interviewers.map(interviewer => ({
        id: interviewer.interviewerId, name: interviewer.displayName, availability: interviewer.availability, active: interviewer.active,
      })),
      availabilitySlotMinutes: round.availabilitySlotMinutes,
      assignmentSlotMinutes: round.assignmentSlotMinutes,
      mode, ...(applicantId ? { applicantId } : {}),
    });
    setAutoDraft(result);
    return result;
  };

  const applyAutoDraft = async () => {
    if (!round || !autoDraft) return false;
    try {
      await applyInterviewAssignmentProposals(roundId, autoDraft.proposals.filter(proposal => !proposal.preserved).map(proposal => {
        const parsed = parseSlotId(proposal.slotId)!;
        const current = joinedApplicants.find(item => item.id === proposal.applicantId)?.assignment;
        return {
          applicantId: proposal.applicantId, slotId: proposal.slotId,
          startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
          durationMinutes: round.assignmentSlotMinutes, interviewerId: proposal.interviewerId,
          interviewerName: proposal.interviewerName, locked: proposal.locked,
          source: proposal.preserved ? current?.source ?? 'manual' : 'automatic',
          status: proposal.preserved ? current?.status ?? 'scheduled' : 'scheduled',
        };
      }));
      toast.success('검토한 자동 배정 초안을 반영했습니다.'); setAutoDraft(null); return true;
    } catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : '자동 배정을 반영하지 못했습니다.'); return false; }
  };

  const changeAssignmentState = async (applicantId: string, patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>) => {
    try { await updateInterviewAssignmentState(applicantId, patch); toast.success('면접 상태를 변경했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접 상태를 변경하지 못했습니다.'); return false; }
  };

  const resolveChangeRequest = async (requestId: string, status: 'resolved' | 'dismissed') => {
    await resolveInterviewChangeRequest(requestId, status); toast.success('변경 요청을 처리했습니다.');
  };

  return {
    round,
    applicants: joinedApplicants,
    filteredApplicants,
    access,
    interviewers,
    changeRequests,
    autoDraft,
    setAutoDraft,
    aggregateAvailability,
    loading,
    filter,
    setFilter,
    search,
    setSearch,
    importRows,
    previewImportRows,
    addApplicant,
    editApplicant,
    archiveApplicant,
    markSent,
    getAssignmentConflict,
    assignApplicant,
    clearAssignment,
    previewScheduleImpact,
    applySchedule,
    addInterviewer,
    saveInterviewerAvailability,
    removeInterviewer,
    runAutoAssignment,
    applyAutoDraft,
    changeAssignmentState,
    resolveChangeRequest,
  };
}
