import { useState, useMemo, useEffect, useRef } from 'react';
import {
  runTransaction,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Attendee, Member, SessionGroup, Session } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';
import { useAsyncActionState } from './useAsyncActionState';

import { getMemberFromAttendee } from '../domain/matching/getMemberFromAttendee';
import {
  deleteAttendeeRecord,
  quickAddMemberRecord,
  manualAddAttendeeRecord,
  importAttendanceRows,
  clearAllAttendees
} from '../services/attendeesService';
import { getSizingNotices } from '../domain/matching/autoAssignAlgorithm';
import { runAutoAssignment } from '../lib/runAutoAssignment';
import { buildUtilityContext, getRequestNotices } from '../domain/matching/personalUtility';
import { getLocalDateKey } from '../domain/attendance/sessionMetadata';
import {
  calculateGroupAverageAttendance,
  calculateGroupAverageStudentId,
  getReunionWarnings
} from '../domain/attendance/attendanceHelpers';
import { useAttendanceDraft } from './useAttendanceDraft';
import { moveAttendee } from '../domain/attendance/moveAttendee';
import { resolveDailySessionId } from '../domain/attendance/dailySession';
import { convertAttendeeIdsToMemberIds } from '../domain/attendance/sessionGroups';
import { addAuditEventToTransaction } from '../services/auditService';
import { archiveDailyPlanning } from '../services/dailyPlanningService';
import type { AttendanceImportInput } from '../domain/attendance/csvParser';
import type { AttendanceMemberDraft } from '../domain/members/attendanceRegistration';

interface UseAttendanceLogicProps {
  onMoveToRecord?: () => void;
  draftScope?: string;
}

export function useAttendanceLogic({ onMoveToRecord, draftScope }: UseAttendanceLogicProps) {
  const { runAction, isPending } = useAsyncActionState();
  const { data: attendees, loading: attendeesLoading, error: attendeesError } = useFirestore<Attendee>('attendees', 'importDate', 'desc');
  const { data: members, loading: membersLoading, error: membersError } = useFirestore<Member>('members');
  const { data: sessions, loading: sessionsLoading, error: sessionsError } = useFirestore<Session>('sessions', 'date', 'desc');
  const assignmentReady = !attendeesLoading && !membersLoading && !sessionsLoading && !attendeesError && !membersError && !sessionsError;

  const [importing, setImporting] = useState(false);
  const [registeringAttendee, setRegisteringAttendee] = useState<Attendee | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const { sessionName, setSessionName, sessionDate, setSessionDate, groups, setGroups,
    isAutoMode, setIsAutoMode, resetDraft, requestSelections, setRequestSelections } = useAttendanceDraft(draftScope ?? null);
  const [requestChoiceKey, setRequestChoiceKey] = useState<string | null>(null);

  // Modals state
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<Attendee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const getMemberFromInfo = (name?: string, studentIdPrefix?: string) => {
    return getMemberFromAttendee(members, name, studentIdPrefix);
  };

  const getMember = (attendeeId: string) => {
    const a = attendees.find(x => x.id === attendeeId);
    return a ? getMemberFromInfo(a.name, a.studentIdPrefix) : undefined;
  };

  const memberAttendanceCount = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => counts[m.id] = 0);
    sessions.forEach(s => {
      s.groups.forEach(g => {
        g.memberIds.forEach(mId => {
          if (counts[mId] !== undefined) counts[mId]++;
        });
      });
    });
    return counts;
  }, [sessions, members]);

  const utilityState = useMemo(() => {
    if (!assignmentReady) return { context: null, error: '' };
    try { return { context: buildUtilityContext({ attendees, members, sessions, assignmentDate: sessionDate, requestSelections }), error: '' }; }
    catch (error) { return { context: null, error: error instanceof Error ? error.message : '명단을 확인해주세요.' }; }
  }, [attendees, members, sessions, sessionDate, assignmentReady, requestSelections]);
  const costContext = utilityState.context;
  const requestChoices = costContext?.requestChoices ?? [];
  const activeRequestChoice = requestChoices.find(choice => choice.key === requestChoiceKey) ?? null;
  const confirmRequestChoice = (key: string, signature: string, recipientId: string | null) => {
    const choice = requestChoices.find(choice => choice.key === key && choice.signature === signature);
    if (!choice || (recipientId !== null && !choice.candidates.some(candidate => candidate.id === recipientId && candidate.memberId))) return;
    setRequestSelections(current => ({ ...current, [key]: { signature, recipientId } }));
    setRequestChoiceKey(null);
  };
  const [isAssigning, setIsAssigning] = useState(false);
  const assignmentController = useRef<AbortController | null>(null);
  useEffect(() => () => { assignmentController.current?.abort(); }, [groups, attendees, members, sessions, sessionDate, assignmentReady, requestSelections]);
  const [lastAssignment, setLastAssignment] = useState<{
    groups: SessionGroup[]; attendees: Attendee[]; members: Member[]; sessions: Session[];
    date: string; sizingNotices: string[]; fixed: Record<string, string>; context: typeof costContext;
  } | null>(null);
  const currentRun = lastAssignment?.groups === groups && lastAssignment.attendees === attendees &&
    lastAssignment.members === members && lastAssignment.sessions === sessions && lastAssignment.date === sessionDate && lastAssignment.context === costContext ? lastAssignment : null;
  const assignmentNotices = [
    ...(utilityState.error ? [utilityState.error] : []),
    ...(currentRun?.sizingNotices ?? []),
    ...(costContext?.absentRequests.filter(r => !groups.some(g => g.memberIds.includes(r.requesterId)))
      .map(r => `${r.requester}님이 요청한 ${r.recipient}님은 불참하여 동반 요청 평가에서 제외했습니다.`) ?? []),
  ];
  const getAssignmentWarnings = (ids: string[]) => costContext ? getRequestNotices(groups, costContext, currentRun?.fixed, ids) : [];
  const recentPairCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.filter(s => {
      const date = s.date?.toDate?.();
      return date && Number.isFinite(date.getTime()) && getLocalDateKey(date) < sessionDate;
    }).sort((a, b) => b.date.toMillis() - a.date.toMillis()).slice(0, 3).forEach(s => {
      s.groups.forEach(g => g.memberIds.forEach((a, i) => g.memberIds.slice(i + 1).forEach(b => {
        const key = [a, b].sort().join('|'); counts[key] = (counts[key] ?? 0) + 1;
      })));
    });
    return counts;
  }, [sessions, sessionDate]);
  const calcGroupAvgAttendance = (attendeeIds: string[]) => calculateGroupAverageAttendance(attendeeIds, getMember, memberAttendanceCount);
  const calcGroupAvgStudentId = (attendeeIds: string[]) => calculateGroupAverageStudentId(attendeeIds, getMember, attendees);
  const getWarnings = (attendeeIds: string[]) => getReunionWarnings(attendeeIds, getMember, recentPairCounts);

  const assignedAttendeeIds = new Set(groups.flatMap(g => g.memberIds));
  const unassignedAttendees = attendees
    .filter(a => !assignedAttendeeIds.has(a.id))
    .sort((a, b) => {
      const memberA = getMemberFromInfo(a.name, a.studentIdPrefix);
      const memberB = getMemberFromInfo(b.name, b.studentIdPrefix);

      const isBoardA = memberA?.isBoardMember ? 1 : 0;
      const isBoardB = memberB?.isBoardMember ? 1 : 0;

      if (isBoardA !== isBoardB) {
        return isBoardB - isBoardA;
      }
      return a.name.localeCompare(b.name);
    });

  const handleDeleteAttendee = async () => {
    if (!attendeeToDelete) return;
    const success = await deleteAttendeeRecord(attendeeToDelete);
    if (success) {
      setGroups(current => current.map(group => ({ ...group, memberIds: group.memberIds.filter(id => id !== attendeeToDelete.id) })));
      setIsDeleteModalOpen(false);
      setAttendeeToDelete(null);
    }
  };

  const handleQuickAddMember = (attendee: Attendee) => {
    setRegisteringAttendee(attendee);
  };
  const handleRegisterMember = async (input: AttendanceMemberDraft) => {
    if (!registeringAttendee) return false;
    const success = await quickAddMemberRecord(registeringAttendee, input);
    if (success) setRegisteringAttendee(null);
    return success;
  };

  const handleManualAdd = async (data: { name: string; studentIdPrefix: string; drink: string; afterparty: boolean; request: string }) => {
    setIsManualAdding(true);
    const success = await manualAddAttendeeRecord(data, members, attendees);
    if (success) {
      setIsManualAddModalOpen(false);
    }
    setIsManualAdding(false);
  };

  const handleImportAttendance = async (input: AttendanceImportInput) => {
    setImporting(true);
    try {
      const success = await importAttendanceRows(input, attendees, members);
      if (success) { setGroups([]); setRequestSelections({}); setRequestChoiceKey(null); }
      return success;
    } finally {
      setImporting(false);
    }
  };

  const clearRecords = async () => {
    const success = await clearAllAttendees(attendees);
    if (success) {
      setGroups([]);
      setRequestSelections({});
      setRequestChoiceKey(null);
    }
  };

  const handleCreateGroup = () => {
    const newGroup: SessionGroup = {
      id: Math.random().toString(36).substring(7),
      memberIds: [],
      gameIds: [],
      notes: ''
    };
    setGroups([...groups, newGroup]);
  };

  const handleUpdateTargetSize = (groupId: string, size: number) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, targetSize: size } : g));
  };

  const performAssignment = async (exportOnly: boolean) => {
    if (assignmentController.current) return;
    if (!assignmentReady) { toast.error('출석 명단·회원 명부·세션 기록을 모두 불러온 뒤 편성해주세요.'); return; }
    if (!costContext) { toast.error(utilityState.error); return; }
    const assigned = new Set(groups.flatMap(g => g.memberIds));
    const availableIds = [...costContext.people.keys()].filter(id => !assigned.has(id));
    const controller = new AbortController();
    assignmentController.current = controller;
    setIsAssigning(true);
    try {
      const result = await runAutoAssignment({ availableIds, initialGroups: groups, context: costContext, withHistory: exportOnly }, controller.signal);
      if (controller.signal.aborted) return;
      if (exportOnly) {
        const report = {
          model: 'personal-utility-v3-protect-then-attenuate-provisional', session_date: sessionDate,
          parameters: costContext.parameters, sizes: result.sizing.sizes,
          selected: { requestProduct: String(result.score.requestProduct), requestScore: result.score.requestScore,
            boardMissing: result.score.boardMissing, boardMissingNonFour: result.score.boardMissingNonFour,
            welfare: result.score.welfare, totalUtility: result.score.totalUtility },
          samples: result.samples,
          note: '탐색 중 채택된 배치의 기록이며, 전체 가능한 배치의 무작위 표본이나 전역 최적해가 아닙니다.',
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `simulation_${sessionDate}.json`; link.click(); URL.revokeObjectURL(url);
        toast.success('개인 효용 평가 데이터가 다운로드되었습니다.');
      } else {
        setLastAssignment({ groups: result.updatedGroups, attendees, members, sessions, date: sessionDate,
          sizingNotices: getSizingNotices(result.sizing, groups), fixed: result.fixed, context: costContext });
        setGroups(result.updatedGroups);
        setIsAutoMode(false);
        toast.success('자동 편성되었습니다. 요청 및 인원 조정 안내를 확인해주세요.');
      }
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : '자동 편성에 실패했습니다.');
    } finally {
      if (assignmentController.current === controller) assignmentController.current = null;
      setIsAssigning(false);
    }
  };
  const handleAutoAssign = () => { void performAssignment(false); };
  const exportSimulationData = () => { void performAssignment(true); };

  const assignToGroup = (memberId: string, groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, memberIds: Array.from(new Set([...g.memberIds, memberId])) } : g
    ));
  };

  const removeFromGroup = (memberId: string, groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== memberId) } : g
    ));
  };

  const handleMoveAttendee = (attendeeId: string, targetGroupId: string | null) => {
    if (!attendees.some(attendee => attendee.id === attendeeId)) return;
    setGroups(current => moveAttendee(current, attendeeId, targetGroupId));
  };

  const handleMoveToRecord = async () => {
    if (isPending('attendance-save')) return;
    if (!sessionName.trim() || !sessionDate) {
      toast.error('세션명과 날짜를 입력해주세요.');
      return;
    }
    if (groups.length === 0) {
      toast.error('최소 1개 이상의 조가 편성되어야 합니다.');
      return;
    }

    const assignedAttendees = groups.flatMap(g => g.memberIds.map(id => attendees.find(a => a.id === id)).filter(Boolean) as Attendee[]);
    const unregistered = assignedAttendees.filter(a => !getMemberFromInfo(a.name, a.studentIdPrefix));

    if (unregistered.length > 0) {
      toast.error(`${unregistered.map(u => u.name).join(', ')}님은 미등록 인원입니다. 먼저 조원 카드에서 추가해주세요!`);
      return;
    }

    const mappedGroups = convertAttendeeIdsToMemberIds(groups, attendees, members);
    const result = await runAction('attendance-save', () => runTransaction(db, async transaction => {
      const planningRef = doc(db, 'DailyPlannings', sessionDate);
      const planningSnapshot = await transaction.get(planningRef);
      const sessionId = resolveDailySessionId({
        planningSessionId: planningSnapshot.data()?.sessionId,
        sessions,
        sessionDate,
        sessionName,
      });
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnapshot = await transaction.get(sessionRef);
      if (planningSnapshot.exists()) {
        archiveDailyPlanning(transaction, sessionDate, planningSnapshot.data(), '모임 다시 시작 전');
      }

      assignedAttendees.forEach(a => {
        transaction.update(doc(db, 'attendees', a.id), { status: '편성됨' });
      });

      transaction.set(planningRef, {
        name: sessionName,
        date: sessionDate,
        groups: mappedGroups,
        attendees: [...new Map(assignedAttendees.map(attendee => [attendee.id, {
          ...attendee,
          memberId: getMemberFromInfo(attendee.name, attendee.studentIdPrefix)!.id,
        }])).values()],
        sessionId,
        createdAt: planningSnapshot.exists() ? planningSnapshot.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (!sessionSnapshot.exists()) {
        transaction.set(sessionRef, {
          name: sessionName,
          date: Timestamp.fromDate(new Date(sessionDate)),
          groups: mappedGroups,
          boardMemberIds: members.filter(member => member.isBoardMember).map(member => member.id),
        });
      }

      addAuditEventToTransaction(transaction, {
        category: 'session',
        action: planningSnapshot.exists() ? 'session.planning_overwritten' : 'session.meeting_started',
        targetId: sessionId,
        targetLabel: sessionName,
        count: assignedAttendees.length,
        detail: `${sessionDate} · ${mappedGroups.length}개 조 · 배정 ${assignedAttendees.length}명`,
      });

    }), {
      successMessage: '모임을 시작하고 세션 기록을 저장했습니다.',
      errorMessage: '모임과 세션 기록을 저장하지 못했습니다.',
      onError: (error) => handleFirestoreError(error, OperationType.WRITE, `DailyPlannings/${sessionDate}`),
    });
    if (result.succeeded) {
      resetDraft();
      onMoveToRecord?.();
    }
  };

  return {
    registeringAttendee, setRegisteringAttendee, handleRegisterMember,
    attendees,
    members,
    sessions,
    importing,
    activeRequestId,
    setActiveRequestId,
    requestChoices, activeRequestChoice, setRequestChoiceKey, confirmRequestChoice,
    sessionName,
    setSessionName,
    sessionDate,
    setSessionDate,
    groups,
    setGroups,
    isAutoMode,
    setIsAutoMode,
    isCostModalOpen,
    setIsCostModalOpen,
    editingGroupId,
    setEditingGroupId,
    editingGroupName,
    setEditingGroupName,
    isManualAddModalOpen,
    setIsManualAddModalOpen,
    isManualAdding,
    attendeeToDelete,
    setAttendeeToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,

    getMember,
    getMemberFromInfo,
    memberAttendanceCount,
    costContext,
    assignmentNotices,
    getAssignmentWarnings,
    isAssigning,
    assignmentReady,
    calculateGroupAverageAttendance: calcGroupAvgAttendance,
    calculateGroupAverageStudentId: calcGroupAvgStudentId,
    getReunionWarnings: getWarnings,
    assignedAttendeeIds,
    unassignedAttendees,

    handleDeleteAttendee,
    handleQuickAddMember,
    handleManualAdd,
    handleImportAttendance,
    clearRecords,
    handleCreateGroup,
    handleUpdateTargetSize,
    handleAutoAssign,
    exportSimulationData,

    assignToGroup,
    removeFromGroup,
    handleMoveAttendee,
    handleMoveToRecord,
    attendanceSaving: isPending('attendance-save'),
  };
}
