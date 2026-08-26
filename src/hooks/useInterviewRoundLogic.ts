import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import type {
  InterviewAccess,
  InterviewApplicant,
  InterviewApplicantWithAccess,
  InterviewAssignment,
  InterviewChangeRequest,
  InterviewOverallRating,
  InterviewRound,
  InterviewRoundInterviewer,
  InterviewSchedule,
  InterviewScheduleInterviewer,
  InterviewSelectionStatus,
} from '../types';
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
  assignRoundInterviewerToSchedule,
  applyInterviewAssignmentProposals,
  applyInterviewScheduleChange,
  completeInterviewAtomically,
  createInterviewApplicant,
  createInterviewSchedule,
  deleteInterviewRound,
  applyConcreteInterviewScheduleChange,
  migrateLegacyApplicantsToInterviewSchedule,
  assignApplicantsToInterviewSchedule,
  archiveInterviewSchedule,
  getInterviewRoundExportRecords,
  getInterviewLink,
  markInterviewMessageSent,
  mergeInterviewApplicants,
  reopenCompletedInterview,
  removeRoundInterviewer,
  removeScheduleInterviewer,
  resolveInterviewChangeRequest,
  resetInterviewApplicantSchedule,
  restoreScheduledInterview,
  saveInterviewAssignment,
  setInterviewApplicantArchived,
  setInterviewApplicantWithdrawn,
  setInterviewActionNeeded,
  subscribeInterviewAccess,
  subscribeInterviewApplicants,
  subscribeInterviewChangeRequests,
  subscribeInterviewRound,
  subscribeInterviewSchedules,
  subscribeScheduleInterviewers,
  subscribeRoundInterviewers,
  updateInterviewApplicant,
  updateInterviewAssignmentState,
  updateCompletedInterviewOverallRating,
  updateInterviewSelectionStatus,
  updateInterviewerPhone,
  updateInterviewerProfile,
  updateRoundInterviewerAvailability,
  updateScheduleInterviewerAvailability,
  type ApplicantDraft,
  type ApplicantImportRow,
  type InterviewRoundDraft,
  type InterviewScheduleDraft,
} from '../services/interviewsService';
import { previewApplicantMerge } from '../domain/interviews/applicantMerge';
import { generateAutoAssignment, type AutoAssignmentMode, type AutoAssignmentResult } from '../domain/interviews/autoAssignment';
import { getInterviewProgressStatus, isAssignmentConfirmationCurrent } from '../domain/interviews/interviewV3Policy';
import { buildInterviewCsvRows } from '../domain/interviews/interviewCsvExport';

export type InterviewApplicantFilter =
  | 'all'
  | 'responded'
  | 'pending'
  | 'assigned'
  | 'unassigned'
  | 'schedule-unassigned'
  | 'schedule-pending'
  | 'assignment-pending'
  | 'completed'
  | 'action-needed'
  | 'availability-unsent'
  | 'availability-sent'
  | 'availability-sent-pending'
  | 'confirmation-unsent'
  | 'confirmation-sent'
  | 'withdrawn'
  | 'archived';

export function useInterviewRoundLogic(roundId: string) {
  const [round, setRound] = useState<InterviewRound | null>(null);
  const [applicants, setApplicants] = useState<InterviewApplicant[]>([]);
  const [access, setAccess] = useState<InterviewAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<InterviewRoundInterviewer[]>([]);
  const [schedules, setSchedules] = useState<InterviewSchedule[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [scheduleInterviewers, setScheduleInterviewers] = useState<InterviewScheduleInterviewer[]>([]);
  const [changeRequests, setChangeRequests] = useState<InterviewChangeRequest[]>([]);
  const [autoDraft, setAutoDraft] = useState<AutoAssignmentResult | null>(null);
  const [filter, setFilter] = useState<InterviewApplicantFilter>('all');
  const [search, setSearch] = useState('');
  const [deletingRound, setDeletingRound] = useState(false);
  const normalizedRoundId = roundId.trim();

  useEffect(() => {
    if (!normalizedRoundId) {
      setRound(null);
      setApplicants([]);
      setAccess([]);
      setInterviewers([]);
      setSchedules([]);
      setActiveScheduleId(null);
      setScheduleInterviewers([]);
      setChangeRequests([]);
      setAutoDraft(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const stopRound = subscribeInterviewRound(normalizedRoundId, value => { setRound(value); setLoading(false); }, error => {
      console.error(error); toast.error('면접 회차를 불러오지 못했습니다.'); setLoading(false);
    });
    const stopApplicants = subscribeInterviewApplicants(normalizedRoundId, setApplicants, console.error);
    const stopAccess = subscribeInterviewAccess(normalizedRoundId, setAccess, console.error);
    const stopInterviewers = subscribeRoundInterviewers(normalizedRoundId, setInterviewers, console.error);
    const stopSchedules = subscribeInterviewSchedules(normalizedRoundId, setSchedules, console.error);
    const stopRequests = subscribeInterviewChangeRequests(normalizedRoundId, setChangeRequests, console.error);
    return () => { stopRound(); stopApplicants(); stopAccess(); stopInterviewers(); stopSchedules(); stopRequests(); };
  }, [normalizedRoundId]);

  useEffect(() => {
    setActiveScheduleId(current => current && schedules.some(schedule => schedule.id === current && schedule.status !== 'archived')
      ? current
      : schedules.find(schedule => schedule.status !== 'archived')?.id ?? null);
  }, [schedules]);

  useEffect(() => {
    if (!activeScheduleId) {
      setScheduleInterviewers([]);
      return undefined;
    }
    return subscribeScheduleInterviewers(activeScheduleId, setScheduleInterviewers, console.error);
  }, [activeScheduleId]);

  const activeSchedule = schedules.find(schedule => schedule.id === activeScheduleId) ?? null;
  const activeSchedulingConfig = activeSchedule ?? round;
  const activeInterviewers: InterviewRoundInterviewer[] = activeScheduleId ? scheduleInterviewers : interviewers;

  const joinedApplicants = useMemo<InterviewApplicantWithAccess[]>(() => {
    const accessByToken = new Map(access.map(item => [item.id, item]));
    return applicants.map(applicant => ({
      ...applicant,
      access: accessByToken.get(applicant.accessToken) ?? null,
      link: getInterviewLink(applicant.accessToken),
    }));
  }, [access, applicants]);

  const filteredApplicants = useMemo(() => joinedApplicants.filter(applicant => {
    const q = search.trim().toLowerCase();
    if (q && !`${applicant.applicantNumber} ${applicant.name} ${applicant.phone}`.toLowerCase().includes(q)) return false;
    const lifecycle = applicant.lifecycle ?? 'active';
    if (filter === 'archived') return lifecycle === 'archived';
    if (lifecycle === 'archived') return false;
    const applicationStatus = applicant.applicationStatus ?? 'active';
    if (filter === 'withdrawn') return applicationStatus === 'withdrawn';
    if (applicationStatus === 'withdrawn') return false;
    const responded = Boolean(applicant.access?.submittedAt);
    const availabilitySent = Boolean(applicant.availabilityMessage.firstMarkedSentAt);
    const confirmationSent = Boolean(applicant.confirmationMessage.firstMarkedSentAt);
    if (filter === 'responded') return responded;
    if (filter === 'pending') return !responded;
    if (filter === 'assigned') return Boolean(applicant.assignment);
    if (filter === 'unassigned') return !applicant.assignment;
    if (filter === 'schedule-unassigned') return applicant.scheduleId === null;
    if (filter === 'schedule-pending') return applicant.scheduleId != null && !responded;
    if (filter === 'assignment-pending') return applicant.scheduleId != null && responded && !applicant.assignment && getInterviewProgressStatus(applicant) === 'scheduled';
    if (filter === 'completed') return getInterviewProgressStatus(applicant) === 'completed';
    if (filter === 'action-needed') return getInterviewProgressStatus(applicant) === 'action_needed';
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
    activeSchedulingConfig?.allowedSlots.forEach(slot => { result[slot] = []; });
    aggregateAvailabilityResponses(access).forEach(cell => {
      if (!result[cell.slotId]) return;
      result[cell.slotId] = cell.applicantIds
        .map(applicantId => applicantsById.get(applicantId))
        .filter((applicant): applicant is InterviewApplicantWithAccess => Boolean(applicant));
    });
    return result;
  }, [access, activeSchedulingConfig, joinedApplicants]);

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
    if (!activeSchedulingConfig) return null;
    const parsed = parseSlotId(slot);
    if (!parsed) return null;
    return {
      slotId: slot,
      startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
      scheduleId: activeSchedule?.id ?? null,
      scheduleName: activeSchedule?.name ?? null,
      durationMinutes: activeSchedulingConfig.assignmentSlotMinutes,
      interviewerId: interviewer.interviewerId,
      interviewerName: interviewer.displayName,
      status: 'scheduled',
      locked: source === 'manual',
      source,
    };
  };

  const getAssignmentConflict = (slot: string, applicantId: string, interviewerId: string) => {
    const interviewer = activeInterviewers.find(item => item.interviewerId === interviewerId);
    const assignment = interviewer ? assignmentFromSlot(slot, interviewer) : null;
    if (!assignment) return null;
    return joinedApplicants.find(other => (
      other.id !== applicantId
      && Boolean(other.assignment)
      && assignmentsOverlap(assignment, other.assignment!)
    )) ?? null;
  };

  const assignApplicant = async (applicant: InterviewApplicantWithAccess, slot: string, interviewerId: string, lock = true) => {
    if (!activeSchedulingConfig) return false;
    if (activeScheduleId && applicant.scheduleId !== activeScheduleId) {
      toast.error('현재 선택한 면접 일정의 지원자만 배정할 수 있습니다.');
      return false;
    }
    const candidates = availabilityToAssignmentCandidates(
      applicant.access?.availability ?? [],
      activeSchedulingConfig.availabilitySlotMinutes,
      activeSchedulingConfig.assignmentSlotMinutes,
    );
    if (!candidates.includes(slot)) {
      toast.error('지원자가 선택하지 않은 시간입니다.');
      return false;
    }
    const interviewer = activeInterviewers.find(item => item.interviewerId === interviewerId && item.active);
    if (!interviewer) { toast.error('면접관을 선택해주세요.'); return false; }
    const interviewerCandidates = availabilityToAssignmentCandidates(interviewer.availability, activeSchedulingConfig.availabilitySlotMinutes, activeSchedulingConfig.assignmentSlotMinutes);
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

  const addInterviewSchedule = async (draft: InterviewScheduleDraft) => {
    try {
      const scheduleId = await createInterviewSchedule(roundId, draft);
      toast.success('면접 일정을 추가했습니다. 지원자를 지정해 가능시간 응답을 받을 수 있습니다.');
      return scheduleId;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 일정을 추가하지 못했습니다.');
      return null;
    }
  };

  const editInterviewSchedule = async (schedule: InterviewSchedule, draft: InterviewScheduleDraft) => {
    try {
      const scheduleApplicants = joinedApplicants.filter(applicant => applicant.scheduleId === schedule.id);
      const impacted = await applyConcreteInterviewScheduleChange(
        roundId,
        schedule.id,
        draft,
        scheduleApplicants.map(applicant => applicant.accessToken),
        scheduleApplicants.map(applicant => applicant.id),
      );
      const summary = [
        impacted.cleanedResponseCount ? `${impacted.cleanedResponseCount}명의 무효 응답 정리` : '',
        impacted.clearedAssignmentCount ? `${impacted.clearedAssignmentCount}명의 기존 배정 해제` : '',
      ].filter(Boolean).join(' · ');
      toast.success(`면접 일정을 저장했습니다${summary ? ` · ${summary}` : ''}.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 일정을 저장하지 못했습니다.');
      return false;
    }
  };

  const previewInterviewScheduleImpact = (schedule: InterviewSchedule, draft: InterviewScheduleDraft) => {
    const scheduleApplicants = joinedApplicants.filter(applicant => applicant.scheduleId === schedule.id);
    const responseImpact = getScheduleChangeImpact(
      schedule.allowedSlots,
      draft.allowedSlots,
      scheduleApplicants.map(applicant => ({ applicantId: applicant.id, availability: applicant.access?.availability ?? [] })),
    );
    const assignmentImpact = getAssignmentScheduleImpact(
      draft.allowedSlots,
      draft.availabilitySlotMinutes,
      draft.assignmentSlotMinutes,
      scheduleApplicants.map(applicant => ({ applicantId: applicant.id, assignment: applicant.assignment })),
    );
    return { ...responseImpact, ...assignmentImpact };
  };

  const archiveSchedule = async (schedule: InterviewSchedule) => {
    const unfinishedApplicants = joinedApplicants.filter(applicant => applicant.scheduleId === schedule.id
      && (applicant.lifecycle ?? 'active') === 'active'
      && (applicant.applicationStatus ?? 'active') === 'active'
      && getInterviewProgressStatus(applicant) !== 'completed');
    if (unfinishedApplicants.length > 0) {
      toast.error(`면접이 끝나지 않은 지원자 ${unfinishedApplicants.length}명이 있어 보관할 수 없습니다.`);
      return false;
    }
    try {
      await archiveInterviewSchedule(schedule);
      toast.success('면접 일정을 보관했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 일정을 보관하지 못했습니다.');
      return false;
    }
  };

  const assignApplicantsToSchedule = async (scheduleId: string, applicantIds: string[]) => {
    try {
      const moved = await assignApplicantsToInterviewSchedule(roundId, scheduleId, applicantIds);
      toast.success(`${moved}명의 지원자에게 면접 일정을 지정했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 일정을 지정하지 못했습니다.');
      return false;
    }
  };

  const migrateLegacyApplicants = async () => {
    if (!round) return null;
    const legacyApplicants = joinedApplicants.filter(applicant => applicant.scheduleId === undefined);
    if (legacyApplicants.length === 0) return null;
    if (legacyApplicants.length > 100) {
      toast.error('기존 지원자가 100명을 초과해 한 번에 안전하게 가져올 수 없습니다. 지원자를 나누는 이전 기능을 먼저 준비해야 합니다.');
      return null;
    }
    const baseName = '기존 면접 일정';
    const existingNames = new Set(schedules.map(schedule => schedule.name));
    const name = existingNames.has(baseName)
      ? `${baseName} ${schedules.filter(schedule => schedule.name.startsWith(baseName)).length + 1}`
      : baseName;
    const scheduleId = await addInterviewSchedule({
      name,
      surveyOpensAt: round.surveyOpensAt.toDate(),
      surveyClosesAt: round.surveyClosesAt.toDate(),
      interviewDates: round.interviewDates,
      dayStartTime: round.dayStartTime,
      dayEndTime: round.dayEndTime,
      availabilitySlotMinutes: round.availabilitySlotMinutes,
      assignmentSlotMinutes: round.assignmentSlotMinutes,
      status: round.status,
      instructions: round.instructions,
      allowedSlots: round.allowedSlots,
      daySchedules: round.daySchedules,
    });
    if (!scheduleId) return null;
    try {
      const moved = await migrateLegacyApplicantsToInterviewSchedule(roundId, scheduleId, legacyApplicants.map(applicant => applicant.id));
      setActiveScheduleId(scheduleId);
      toast.success(`기존 지원자 ${moved}명을 응답과 배정을 보존한 채 가져왔습니다.`);
      return scheduleId;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '기존 면접 데이터를 가져오지 못했습니다. 생성된 일정에는 지원자가 지정되지 않았습니다.');
      return null;
    }
  };

  const editApplicant = async (applicant: InterviewApplicantWithAccess, draft: ApplicantDraft) => {
    try { await updateInterviewApplicant(applicant, draft); toast.success('지원자 정보를 수정했습니다.'); return true; }
    catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : '지원자 정보를 수정하지 못했습니다.'); return false; }
  };

  const archiveApplicant = async (applicant: InterviewApplicantWithAccess, archived: boolean) => {
    try { await setInterviewApplicantArchived(applicant, archived); toast.success(archived ? '지원자를 보관 처리했습니다.' : '지원자를 복원했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('지원자 상태를 바꾸지 못했습니다.'); return false; }
  };

  const addInterviewer = async (name: string, email?: string, phone?: string) => {
    const normalizedName = name.trim().replace(/\s+/g, '').toLowerCase();
    const sameName = interviewers.find(item => item.active && item.displayName.trim().replace(/\s+/g, '').toLowerCase() === normalizedName);
    if (sameName) {
      const sameContact = (!email || sameName.email?.toLowerCase() === email.trim().toLowerCase()) && (!phone || sameName.phone === phone);
      if (sameContact) { toast.error('같은 이름과 연락처의 면접관이 이미 명부에 있습니다.'); return false; }
      if (!window.confirm(`명부에 같은 이름의 “${sameName.displayName}” 면접관이 있습니다.\n동명이인으로 새로 추가할까요?`)) return false;
    }
    try { await addRoundInterviewer(roundId, { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) }); toast.success('면접관 명부에 추가했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접관을 추가하지 못했습니다.'); return false; }
  };

  const editInterviewer = async (participant: InterviewRoundInterviewer, name: string, email?: string, phone?: string) => {
    try { await updateInterviewerProfile(participant, { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) }); toast.success('면접관 정보를 수정했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접관 정보를 수정하지 못했습니다.'); return false; }
  };

  const saveInterviewerAvailability = async (participantId: string, availability: string[]) => {
    try {
      if (activeScheduleId) await updateScheduleInterviewerAvailability(participantId, availability);
      else await updateRoundInterviewerAvailability(participantId, availability);
      toast.success('면접관 가능시간을 저장했습니다.'); return true;
    }
    catch (error) { console.error(error); toast.error('면접관 가능시간을 저장하지 못했습니다.'); return false; }
  };

  const saveInterviewerPhone = async (participant: InterviewRoundInterviewer, phone: string) => {
    try { await updateInterviewerPhone(participant, phone); toast.success('면접관 연락처를 저장했습니다.'); return true; }
    catch (error) { console.error(error); toast.error('면접관 연락처를 저장하지 못했습니다.'); return false; }
  };

  const removeInterviewer = async (participant: InterviewRoundInterviewer) => {
    if (joinedApplicants.some(applicant => applicant.assignment?.interviewerId === participant.interviewerId && (activeScheduleId == null || applicant.scheduleId === activeScheduleId))) {
      toast.error('배정된 지원자가 있는 면접관은 먼저 일정을 변경해야 합니다.'); return false;
    }
    if (activeScheduleId) await removeScheduleInterviewer(participant.id);
    else await removeRoundInterviewer(participant);
    toast.success(activeScheduleId ? '현재 면접 일정에서 면접관을 제외했습니다.' : '회차에서 면접관을 제외했습니다.'); return true;
  };

  const assignInterviewer = async (participant: InterviewRoundInterviewer) => {
    if (!activeScheduleId) {
      toast.error('면접관을 추가할 일정을 먼저 선택해주세요.');
      return false;
    }
    try {
      await assignRoundInterviewerToSchedule(roundId, activeScheduleId, participant.interviewerId);
      toast.success(`${participant.displayName} 면접관을 현재 일정에 추가했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접관을 일정에 추가하지 못했습니다.');
      return false;
    }
  };

  const removeRound = async () => {
    if (deletingRound || !round) return false;
    setDeletingRound(true);
    try {
      const result = await deleteInterviewRound(round.id);
      toast.success(`${round.name} 회차와 관련 데이터 ${result.deletedDocuments}건을 삭제했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 회차를 삭제하지 못했습니다.');
      return false;
    } finally {
      setDeletingRound(false);
    }
  };


  const runAutoAssignment = (mode: AutoAssignmentMode, applicantId?: string) => {
    if (!activeSchedulingConfig) return null;
    const schedulingApplicants = activeScheduleId
      ? joinedApplicants.filter(applicant => applicant.scheduleId === activeScheduleId)
      : joinedApplicants.filter(applicant => applicant.scheduleId === null);
    const openChangeRequestApplicantIds = new Set(changeRequests.filter(item => item.status === 'open').map(item => item.applicantId));
    const result = generateAutoAssignment({
      applicants: schedulingApplicants.map(applicant => ({
        id: applicant.id, name: applicant.name, availability: applicant.access?.availability ?? [],
        lifecycle: applicant.lifecycle ?? 'active',
        withdrawn: (applicant.applicationStatus ?? 'active') === 'withdrawn',
        interviewStatus: openChangeRequestApplicantIds.has(applicant.id)
          ? 'action_needed'
          : getInterviewProgressStatus(applicant),
        assignmentRevision: applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0,
        existingAssignment: applicant.assignment?.slotId ? {
          slotId: applicant.assignment.slotId, interviewerId: applicant.assignment.interviewerId,
          interviewerName: applicant.assignment.interviewerName, locked: applicant.assignment.locked,
          source: applicant.assignment.source, status: applicant.assignment.status,
          confirmationCurrent: isAssignmentConfirmationCurrent(applicant),
        } : null,
      })),
      interviewers: activeInterviewers.map(interviewer => ({
        id: interviewer.interviewerId, name: interviewer.displayName, availability: interviewer.availability, active: interviewer.active,
      })),
      availabilitySlotMinutes: activeSchedulingConfig.availabilitySlotMinutes,
      assignmentSlotMinutes: activeSchedulingConfig.assignmentSlotMinutes,
      mode, ...(applicantId ? { applicantId } : {}),
    });
    setAutoDraft(result);
    return result;
  };

  const applyAutoDraft = async () => {
    if (!activeSchedulingConfig || !autoDraft) return false;
    try {
      await applyInterviewAssignmentProposals(roundId, autoDraft.proposals.filter(proposal => !proposal.preserved).map(proposal => {
        const parsed = parseSlotId(proposal.slotId)!;
        const current = joinedApplicants.find(item => item.id === proposal.applicantId)?.assignment;
        return {
          applicantId: proposal.applicantId, slotId: proposal.slotId,
          startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
          durationMinutes: activeSchedulingConfig.assignmentSlotMinutes, interviewerId: proposal.interviewerId,
          interviewerName: proposal.interviewerName, locked: proposal.locked,
          source: proposal.preserved ? current?.source ?? 'manual' : 'automatic',
          status: proposal.preserved ? current?.status ?? 'scheduled' : 'scheduled',
          expectedAssignmentRevision: proposal.expectedAssignmentRevision,
        };
      }), activeSchedule?.id ?? null);
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

  const resetApplicantSchedule = async (applicantId: string) => {
    try {
      await resetInterviewApplicantSchedule(applicantId);
      toast.success('일정을 초기화했습니다. 기존 배정은 이력으로 보존되며 새 접속부터 4일 범위를 다시 계산합니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '일정을 초기화하지 못했습니다.');
      return false;
    }
  };

  const setApplicantWithdrawn = async (applicantId: string, withdrawn: boolean) => {
    try {
      await setInterviewApplicantWithdrawn(applicantId, withdrawn);
      toast.success(withdrawn
        ? '지원 철회 처리했습니다. 링크와 현재 활성 배정이 비활성화되었습니다.'
        : '지원 철회를 취소했습니다. 기존 배정은 자동 복원되지 않습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '지원 상태를 변경하지 못했습니다.');
      return false;
    }
  };

  const markActionNeeded = async (applicantId: string, reason = '') => {
    try {
      await setInterviewActionNeeded(applicantId, reason);
      toast.success('조치 필요 목록으로 이동했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 상태를 변경하지 못했습니다.');
      return false;
    }
  };

  const restoreScheduled = async (applicantId: string) => {
    try {
      await restoreScheduledInterview(applicantId);
      toast.success('예정 목록으로 되돌렸습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 상태를 변경하지 못했습니다.');
      return false;
    }
  };

  const completeApplicantInterview = async (applicantId: string, note: {
    generalNotes?: string;
    answers?: Record<string, string>;
    overallRating: InterviewOverallRating | null;
  }) => {
    if (!applicantId?.trim()) {
      toast.error('지원자 정보를 확인하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.');
      return false;
    }
    const applicant = joinedApplicants.find(item => item.id === applicantId);
    if (!applicant?.assignment) {
      toast.error('현재 면접 배정이 없습니다.');
      return false;
    }
    try {
      await completeInterviewAtomically({
        roundId,
        applicantId,
        interviewerId: applicant.assignment.interviewerId,
        interviewerName: applicant.assignment.interviewerName,
        ...note,
      });
      toast.success('종합평가와 면접 완료 상태를 함께 저장했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접을 완료하지 못했습니다.');
      return false;
    }
  };

  const reopenCompletedApplicantInterview = async (applicantId: string) => {
    try {
      await reopenCompletedInterview(applicantId);
      toast.success('면접을 예정 상태로 되돌렸습니다. 기존 기록과 평가는 보존됩니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 완료를 취소하지 못했습니다.');
      return false;
    }
  };

  const updateSelectionStatus = async (applicantId: string, status: InterviewSelectionStatus) => {
    const applicant = joinedApplicants.find(item => item.id === applicantId);
    if (status !== 'selected' && applicant?.selectionStatus === 'selected' && applicant.memberId) {
      const confirmed = window.confirm('선발을 취소해도 등록된 동아리원 정보는 자동 삭제되지 않습니다. 필요한 경우 동아리원 관리에서 직접 처리해주세요.\n\n선발 상태를 변경할까요?');
      if (!confirmed) return false;
    }
    try {
      await updateInterviewSelectionStatus(applicantId, status);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '선발 상태를 저장하지 못했습니다.');
      return false;
    }
  };

  const updateCompletedRating = async (applicantId: string, rating: InterviewOverallRating) => {
    try {
      await updateCompletedInterviewOverallRating(applicantId, rating);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '종합평가를 수정하지 못했습니다.');
      return false;
    }
  };

  const getApplicantExport = async () => {
    if (!round) throw new Error('면접 회차를 불러온 뒤 내보낼 수 있습니다.');
    const records = await getInterviewRoundExportRecords(round.id);
    return {
      filename: `${round.name}_전체_지원자_내보내기.csv`,
      rows: buildInterviewCsvRows({ round, applicants: joinedApplicants, ...records }),
    };
  };

  return {
    round,
    applicants: joinedApplicants,
    filteredApplicants,
    access,
    interviewers,
    schedules,
    activeSchedule,
    activeScheduleId,
    setActiveScheduleId,
    scheduleInterviewers,
    activeInterviewers,
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
    addInterviewSchedule,
    editInterviewSchedule,
    previewInterviewScheduleImpact,
    archiveSchedule,
    assignApplicantsToSchedule,
    migrateLegacyApplicants,
    editApplicant,
    archiveApplicant,
    markSent,
    getAssignmentConflict,
    assignApplicant,
    clearAssignment,
    previewScheduleImpact,
    applySchedule,
    addInterviewer,
    editInterviewer,
    saveInterviewerAvailability,
    saveInterviewerPhone,
    removeInterviewer,
    assignInterviewer,
    runAutoAssignment,
    applyAutoDraft,
    changeAssignmentState,
    resolveChangeRequest,
    resetApplicantSchedule,
    setApplicantWithdrawn,
    markActionNeeded,
    restoreScheduled,
    completeApplicantInterview,
    reopenCompletedInterview: reopenCompletedApplicantInterview,
    updateCompletedRating,
    updateSelectionStatus,
    getApplicantExport,
    deletingRound,
    removeRound,
  };
}
