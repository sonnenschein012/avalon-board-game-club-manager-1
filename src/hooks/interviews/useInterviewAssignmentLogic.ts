import { getApplicantAssignmentRevision } from '../../domain/interviews/interviewTransitions';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  generateAutoAssignment,
  type AutoAssignmentMode,
  type AutoAssignmentResult,
} from '../../domain/interviews/autoAssignment';
import {
  getInterviewProgressStatus,
  isActiveInterviewApplicant,
  isAssignmentConfirmationCurrent,
} from '../../domain/interviews/interviewPolicy';
import { applyOptimisticAssignment, rollbackOptimisticApplicant } from '../../domain/interviews/optimisticApplicant';
import { isInterviewRevisionConflict } from '../../domain/interviews/revisionConflict';
import {
  assignmentsOverlap,
  availabilityToAssignmentCandidates,
  parseSlotId,
} from '../../domain/interviews/scheduling';
import {
  applyInterviewAssignmentProposals,
  saveInterviewAssignment,
  updateInterviewAssignmentState,
} from '../../services/interviewsService';
import type { InterviewApplicantWithAccess, InterviewAssignment, InterviewRoundInterviewer } from '../../types';
import { useAsyncActionState } from '../useAsyncActionState';
import type { InterviewRoundData } from './useInterviewRoundData';

type AssignmentData = Pick<InterviewRoundData,
  'activeSchedulingConfig' | 'activeSchedule' | 'activeScheduleId' | 'activeInterviewers'
  | 'joinedApplicants' | 'applicantById' | 'joinedApplicantById' | 'setApplicants' | 'changeRequests'
>;

export function useInterviewAssignmentLogic(roundId: string, data: AssignmentData) {
  const { activeSchedulingConfig, activeSchedule, activeScheduleId, activeInterviewers,
    joinedApplicants, applicantById, joinedApplicantById, setApplicants, changeRequests } = data;
  const [autoDraft, setAutoDraft] = useState<AutoAssignmentResult | null>(null);
  const { runAction, isPending } = useAsyncActionState();
  const normalizedRoundId = roundId.trim();

  useEffect(() => {
    if (!normalizedRoundId) setAutoDraft(null);
  }, [normalizedRoundId]);

  const assignmentFromSlot = (slot: string, interviewer: InterviewRoundInterviewer): InterviewAssignment | null => {
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
      locked: false,
      source: 'manual',
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

  const assignApplicant = async (applicant: InterviewApplicantWithAccess, slot: string, interviewerId: string) => {
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
    const conflict = getAssignmentConflict(slot, applicant.id, interviewerId);
    if (conflict) {
      toast.error(`${interviewer.displayName} 면접관 일정이 ${conflict.name} 지원자와 겹칩니다.`);
      return false;
    }
    const previousApplicant = applicantById.get(applicant.id) ?? applicant;
    const optimisticApplicant = applyOptimisticAssignment(previousApplicant, assignment);
    setApplicants(current => current.map(item => item.id === applicant.id ? optimisticApplicant : item));
    try {
      await saveInterviewAssignment(
        applicant.id,
        assignment,
        getApplicantAssignmentRevision(applicant),
      );
      const notice = applicant.confirmationMessage.firstMarkedSentAt
        ? ' 기존 확정 안내는 이전 시간 기준이므로 새 문자를 다시 보내주세요.'
        : '';
      toast.success(`${applicant.name} 지원자의 면접 시간을 배정했습니다.${notice}`);
      return true;
    } catch (error) {
      console.error(error);
      setApplicants(current => current.map(item => item.id === applicant.id
        ? rollbackOptimisticApplicant(item, optimisticApplicant, previousApplicant)
        : item));
      toast.error(error instanceof Error ? error.message : '면접 시간을 저장하지 못했습니다.');
      return false;
    }
  };

  const clearAssignment = async (applicantId: string) => {
    const applicant = joinedApplicantById.get(applicantId);
    if (!applicant) return;
    const previousApplicant = applicantById.get(applicantId) ?? applicant;
    const optimisticApplicant = applyOptimisticAssignment(previousApplicant, null);
    setApplicants(current => current.map(item => item.id === applicantId ? optimisticApplicant : item));
    try {
      await saveInterviewAssignment(
        applicantId,
        null,
        applicant ? getApplicantAssignmentRevision(applicant) : 0,
      );
      const notice = applicant?.confirmationMessage.firstMarkedSentAt
        ? ' 이전 확정 안내 기록은 이력으로 남아 있습니다.'
        : '';
      toast.success(`배정을 해제했습니다.${notice}`);
    } catch (error) {
      console.error(error);
      setApplicants(current => current.map(item => item.id === applicantId
        ? rollbackOptimisticApplicant(item, optimisticApplicant, previousApplicant)
        : item));
      toast.error(error instanceof Error ? error.message : '배정을 해제하지 못했습니다.');
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
        autoAssignmentTarget: isActiveInterviewApplicant(applicant)
          && Boolean(applicant.access?.submittedAt)
          && (mode !== 'unassigned' || !applicant.assignment),
        lifecycle: applicant.lifecycle ?? 'active',
        withdrawn: (applicant.applicationStatus ?? 'active') === 'withdrawn',
        interviewStatus: openChangeRequestApplicantIds.has(applicant.id)
          ? 'action_needed'
          : getInterviewProgressStatus(applicant),
        assignmentRevision: getApplicantAssignmentRevision(applicant),
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
    if (isPending('auto-draft-apply')) return false;
    const result = await runAction('auto-draft-apply', async () => {
      await applyInterviewAssignmentProposals(roundId, autoDraft.proposals.filter(proposal => !proposal.preserved).map(proposal => {
        const parsed = parseSlotId(proposal.slotId)!;
        return {
          applicantId: proposal.applicantId, slotId: proposal.slotId,
          startsAt: Timestamp.fromDate(new Date(`${parsed.date}T${parsed.time}:00+09:00`)),
          durationMinutes: activeSchedulingConfig.assignmentSlotMinutes, interviewerId: proposal.interviewerId,
          interviewerName: proposal.interviewerName, locked: proposal.locked,
          source: 'automatic',
          status: 'scheduled',
          expectedAssignmentRevision: proposal.expectedAssignmentRevision,
        };
      }), activeSchedule?.id ?? null);
      setAutoDraft(null);
      return true;
    }, {
      successMessage: '검토한 자동 배정 초안을 반영했습니다.',
      errorMessage: '자동 배정을 반영하지 못했습니다.',
      onError: console.error,
    });
    return result.succeeded && (result.value ?? false);
  };

  const changeAssignmentState = async (applicantId: string, patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>) => {
    const key = `assignment-state:${applicantId}`;
    if (isPending(key)) return false;
    const previousApplicant = applicantById.get(applicantId);
    if (!previousApplicant?.assignment) return false;
    const optimisticApplicant = {
      ...previousApplicant,
      assignment: { ...previousApplicant.assignment, ...patch },
    };
    setApplicants(current => current.map(item => item.id === applicantId ? optimisticApplicant : item));
    let actionError: unknown;
    const result = await runAction(key, async () => {
      const applicant = joinedApplicantById.get(applicantId);
      await updateInterviewAssignmentState(
        applicantId,
        patch,
        applicant ? getApplicantAssignmentRevision(applicant) : 0,
        applicant?.updatedAt?.toMillis(),
      );
      return true;
    }, {
      successMessage: '면접 상태를 변경했습니다.',
      errorMessage: '면접 상태를 변경하지 못했습니다.',
      onError: (error) => { actionError = error; console.error(error); },
    });
    if (!result.succeeded && !isInterviewRevisionConflict(actionError)) {
      setApplicants(current => current.map(item => item.id === applicantId
        ? rollbackOptimisticApplicant(item, optimisticApplicant, previousApplicant)
        : item));
    }
    return result.succeeded && (result.value ?? false);
  };

  return { autoDraft, setAutoDraft, assignApplicant, clearAssignment, runAutoAssignment, applyAutoDraft, changeAssignmentState };
}
