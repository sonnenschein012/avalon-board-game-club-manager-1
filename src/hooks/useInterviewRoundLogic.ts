import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { filterInterviewApplicants, type InterviewApplicantFilter } from '../domain/interviews/applicantFilter';
import { previewApplicantMerge } from '../domain/interviews/applicantMerge';
import { buildInterviewCsvRows } from '../domain/interviews/interviewCsvExport';
import { getInterviewProgressStatus } from '../domain/interviews/interviewPolicy';
import {
  getAssignmentScheduleImpact,
  getScheduleChangeImpact
} from '../domain/interviews/scheduling';
import {
  addRoundInterviewer,
  applyConcreteInterviewScheduleChange,
  assignApplicantsToInterviewSchedule,
  assignRoundInterviewerToSchedule,
  completeInterviewAtomically,
  createInterviewApplicant,
  createInterviewSchedule,
  deleteInterviewRound,
  deleteInterviewSchedule,
  getInterviewRoundExportRecords,
  hasInterviewRoundNotes,
  markInterviewMessageSent,
  mergeInterviewApplicants,
  migrateLegacyApplicantsToInterviewSchedule,
  reactivateRoundInterviewer,
  removeRoundInterviewer,
  removeScheduleInterviewer,
  reopenCompletedInterview,
  resetInterviewApplicantSchedule,
  resolveInterviewChangeRequest,
  restoreScheduledInterview,
  setInterviewActionNeeded,
  setInterviewApplicantArchived,
  setInterviewApplicantWithdrawn,
  updateCompletedInterviewOverallRating,
  updateInterviewApplicant,
  updateInterviewRoundSettings,
  updateInterviewSelectionStatus,
  updateInterviewerProfile,
  updateRoundInterviewerAvailability,
  updateScheduleInterviewerAvailability,
  type ApplicantDraft,
  type ApplicantImportRow,
  type InterviewRoundDraft,
  type InterviewScheduleDraft
} from '../services/interviewsService';
import type {
  InterviewApplicantWithAccess,
  InterviewOverallRating,
  InterviewRoundInterviewer,
  InterviewSchedule,
  InterviewSelectionStatus
} from '../types';
import { useInterviewAssignmentLogic } from './interviews/useInterviewAssignmentLogic';
import { useInterviewRoundData } from './interviews/useInterviewRoundData';

export function useInterviewRoundLogic(roundId: string) {
  const data = useInterviewRoundData(roundId);
  const {
    round, setRound, applicants, setApplicants, joinedApplicants, applicantById, joinedApplicantById,
    loading, interviewers, schedules, activeSchedule, activeScheduleId, setActiveScheduleId,
    activeInterviewers, roundScheduleInterviewers, changeRequests,
  } = data;
  const assignments = useInterviewAssignmentLogic(roundId, data);
  const [filter, setFilter] = useState<InterviewApplicantFilter>('all');
  const [search, setSearch] = useState('');
  const [deletingRound, setDeletingRound] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const filteredApplicants = useMemo(
    () => filterInterviewApplicants(joinedApplicants, filter, deferredSearch),
    [deferredSearch, filter, joinedApplicants],
  );

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
      const applicant = applicantById.get(applicantId);
      if (!applicant) throw new Error('지원자를 찾을 수 없습니다.');
      await markInterviewMessageSent(applicantId, kind, markedSent);
      toast.success(markedSent ? '발송 표시를 기록했습니다.' : '발송 표시를 취소했습니다.');
    } catch (error) {
      console.error(error);
      toast.error('발송 표시를 변경하지 못했습니다.');
    }
  };

  const applySettings = async (draft: InterviewRoundDraft) => {
    try {
      await updateInterviewRoundSettings(roundId, draft);
      setRound(current => current ? {
        ...current,
        name: draft.name.trim(),
        instructions: draft.instructions,
        messageTemplates: draft.messageTemplates,
        interviewQuestions: draft.interviewQuestions,
      } : current);
      toast.success('회차 공통 설정을 저장했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('회차 설정을 저장하지 못했습니다.');
      return false;
    }
  };

  const hasInterviewActivity = async () => (
    joinedApplicants.some(applicant => (
      getInterviewProgressStatus(applicant) === 'completed' || Boolean(applicant.overallRating)
    )) || await hasInterviewRoundNotes(roundId)
  );

  const addApplicant = async (draft: ApplicantDraft) => {
    try {
      await createInterviewApplicant(roundId, draft);
      toast.success('지원자를 추가했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '지원자를 추가하지 못했습니다.');
      return false;
    }
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

  const editInterviewSchedule = async (schedule: InterviewSchedule, draft: InterviewScheduleDraft, expectedScheduleRevision?: number) => {
    try {
      const scheduleApplicants = joinedApplicants.filter(applicant => applicant.scheduleId === schedule.id);
      const impacted = await applyConcreteInterviewScheduleChange(
        roundId,
        schedule.id,
        draft,
        scheduleApplicants.map(applicant => applicant.accessToken),
        scheduleApplicants.map(applicant => applicant.id),
        expectedScheduleRevision ?? schedule.scheduleRevision,
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

  const deleteSchedule = async (schedule: InterviewSchedule) => {
    try {
      await deleteInterviewSchedule(schedule);
      toast.success('사용하지 않은 면접 일정을 삭제했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접 일정을 삭제하지 못했습니다.');
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
    const previousApplicant = applicantById.get(applicant.id) ?? applicant;
    const optimisticApplicant = {
      ...previousApplicant,
      applicantNumber: draft.applicantNumber.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      applicationData: draft.applicationData,
    };
    setApplicants(current => current.map(item => item.id === applicant.id ? optimisticApplicant : item));
    try {
      await updateInterviewApplicant(applicant, draft);
      toast.success('지원자 정보를 수정했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      setApplicants(current => current.map(item => {
        if (item.id !== applicant.id) return item;
        const stillOptimistic = item.applicantNumber === optimisticApplicant.applicantNumber
          && item.name === optimisticApplicant.name
          && item.phone === optimisticApplicant.phone
          && JSON.stringify(item.applicationData) === JSON.stringify(optimisticApplicant.applicationData);
        return stillOptimistic ? previousApplicant : item;
      }));
      toast.error(error instanceof Error ? error.message : '지원자 정보를 수정하지 못했습니다.');
      return false;
    }
  };

  const archiveApplicant = async (applicant: InterviewApplicantWithAccess, archived: boolean) => {
    try {
      await setInterviewApplicantArchived(applicant, archived);
      toast.success(archived ? '지원자를 보관 처리했습니다.' : '지원자를 복원했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('지원자 상태를 바꾸지 못했습니다.');
      return false;
    }
  };

  const addInterviewer = async (name: string, email?: string, phone?: string) => {
    const normalizedName = name.trim().replace(/\s+/g, '').toLowerCase();
    const normalizedEmail = email?.trim().toLowerCase();
    const sameName = interviewers.find(item => item.active && item.displayName.trim().replace(/\s+/g, '').toLowerCase() === normalizedName);
    if (sameName) {
      const sameContact = (!email || sameName.email?.toLowerCase() === email.trim().toLowerCase()) && (!phone || sameName.phone === phone);
      if (sameContact) { toast.error('같은 이름과 연락처의 면접관이 이미 명부에 있습니다.'); return false; }
      if (!window.confirm(`명부에 같은 이름의 “${sameName.displayName}” 면접관이 있습니다.\n동명이인으로 새로 추가할까요?`)) return false;
    }
    const inactiveMatch = interviewers.find(item => !item.active
      && item.displayName.trim().replace(/\s+/g, '').toLowerCase() === normalizedName
      && (!normalizedEmail || item.email?.toLowerCase() === normalizedEmail)
      && (!phone || item.phone === phone));
    if (inactiveMatch) {
      try {
        await reactivateRoundInterviewer(inactiveMatch);
        toast.success('기존 면접관을 명부에 다시 추가했습니다.');
        return true;
      } catch (error) {
        console.error(error);
        toast.error('면접관을 다시 추가하지 못했습니다.');
        return false;
      }
    }
    try {
      await addRoundInterviewer(roundId, { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) });
      toast.success('면접관 명부에 추가했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('면접관을 추가하지 못했습니다.');
      return false;
    }
  };

  const editInterviewer = async (participant: InterviewRoundInterviewer, name: string, email?: string, phone?: string) => {
    try {
      await updateInterviewerProfile(participant, { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) });
      toast.success('면접관 정보를 수정했습니다.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('면접관 정보를 수정하지 못했습니다.');
      return false;
    }
  };

  const saveInterviewerAvailability = async (participantId: string, availability: string[], expectedUpdatedAtMillis?: number) => {
    try {
      if (activeScheduleId) await updateScheduleInterviewerAvailability(participantId, availability, expectedUpdatedAtMillis);
      else await updateRoundInterviewerAvailability(participantId, availability, expectedUpdatedAtMillis);
      toast.success('면접관 가능시간을 저장했습니다.');
      return true;
    }
    catch (error) {
      console.error(error);
      toast.error('면접관 가능시간을 저장하지 못했습니다.');
      return false;
    }
  };

  const removeInterviewer = async (participant: InterviewRoundInterviewer) => {
    if (joinedApplicants.some(applicant => applicant.assignment?.interviewerId === participant.interviewerId && (activeScheduleId == null || applicant.scheduleId === activeScheduleId))) {
      toast.error('배정된 지원자가 있는 면접관은 먼저 일정을 변경해야 합니다.');
      return false;
    }
    if (activeScheduleId) await removeScheduleInterviewer(participant.id);
    else await removeRoundInterviewer(participant);
    toast.success(activeScheduleId ? '현재 면접 일정에서 면접관을 제외했습니다.' : '회차에서 면접관을 제외했습니다.');
    return true;
  };

  const assignInterviewer = async (participant: InterviewRoundInterviewer) => {
    if (!activeScheduleId) {
      toast.error('면접관을 배정할 일정을 먼저 선택해주세요.');
      return false;
    }
    try {
      await assignRoundInterviewerToSchedule(roundId, activeScheduleId, participant.interviewerId);
      toast.success(`${participant.displayName} 면접관을 현재 일정에 배정했습니다.`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '면접관을 배정하지 못했습니다.');
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


  const resolveChangeRequest = async (requestId: string, status: 'resolved' | 'dismissed') => {
    await resolveInterviewChangeRequest(requestId, status);
    toast.success('변경 요청을 처리했습니다.');
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
    expectedNoteRevision?: number;
  }) => {
    if (!applicantId?.trim()) {
      toast.error('지원자 정보를 확인하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.');
      return false;
    }
    const applicant = joinedApplicantById.get(applicantId);
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
    const applicant = joinedApplicantById.get(applicantId);
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
    ...assignments,
    round,
    applicants: joinedApplicants,
    filteredApplicants,
    interviewers,
    schedules,
    activeSchedule,
    activeScheduleId,
    setActiveScheduleId,
    roundScheduleInterviewers,
    activeInterviewers,
    changeRequests,
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
    deleteSchedule,
    assignApplicantsToSchedule,
    migrateLegacyApplicants,
    editApplicant,
    archiveApplicant,
    markSent,
    applySettings,
    hasInterviewActivity,
    addInterviewer,
    editInterviewer,
    saveInterviewerAvailability,
    removeInterviewer,
    assignInterviewer,
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
