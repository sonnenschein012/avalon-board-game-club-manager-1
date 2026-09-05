import React, { useState, useMemo } from 'react';
import {
  writeBatch,
  doc,
  serverTimestamp,
  getDoc,
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
  importAttendeesFile,
  clearAllAttendees
} from '../services/attendeesService';
import { simulateAutoAssign } from '../domain/matching/autoAssignAlgorithm';
import {
  calculateGroupAverageAttendance,
  calculateGroupAverageStudentId,
  getReunionWarnings
} from '../domain/attendance/attendanceHelpers';
import { getDefaultSessionName, getTodaySessionMetadata } from '../domain/attendance/sessionMetadata';
import { buildGroupCostContext } from '../domain/matching/groupCostContext';
import { resolveDailySessionId } from '../domain/attendance/dailySession';
import { convertAttendeeIdsToMemberIds } from '../domain/attendance/sessionGroups';
import { addAuditEventToBatch } from '../services/auditService';

interface UseAttendanceLogicProps {
  onMoveToRecord?: () => void;
}

export function useAttendanceLogic({ onMoveToRecord }: UseAttendanceLogicProps) {
  const { runAction, isPending } = useAsyncActionState();
  const { data: attendees } = useFirestore<Attendee>('attendees', 'importDate', 'desc');
  const { data: members } = useFirestore<Member>('members');
  const { data: sessions } = useFirestore<Session>('sessions', 'date', 'desc');

  const [importing, setImporting] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const [initialSessionMetadata] = useState(() => getTodaySessionMetadata());
  const [sessionName, setSessionNameState] = useState(initialSessionMetadata.sessionName);
  const [sessionDate, setSessionDateState] = useState(initialSessionMetadata.sessionDate);
  const [isSessionNameCustom, setIsSessionNameCustom] = useState(false);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Modals state
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<Attendee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // A changed date should update an untouched default name, while preserving
  // the operator's own wording once they have edited it.
  const setSessionName = (name: string) => {
    setIsSessionNameCustom(true);
    setSessionNameState(name);
  };

  const setSessionDate = (date: string) => {
    setSessionDateState(date);
    if (!isSessionNameCustom) {
      setSessionNameState(getDefaultSessionName(date));
    }
  };

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

  const costContext = useMemo(() => buildGroupCostContext({
    attendees, members, sessions, assignmentDate: sessionDate,
  }), [attendees, members, sessions, sessionDate]);

  const calcGroupAvgAttendance = (attendeeIds: string[]) => calculateGroupAverageAttendance(attendeeIds, getMember, memberAttendanceCount);
  const calcGroupAvgStudentId = (attendeeIds: string[]) => calculateGroupAverageStudentId(attendeeIds, getMember, attendees);
  const getWarnings = (attendeeIds: string[]) => getReunionWarnings(attendeeIds, getMember, costContext.memberPairRecentCounts);

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
      setIsDeleteModalOpen(false);
      setAttendeeToDelete(null);
    }
  };

  const handleQuickAddMember = async (attendee: Attendee) => {
    await quickAddMemberRecord(attendee);
  };

  const handleManualAdd = async (data: { name: string; studentIdPrefix: string; drink: string; afterparty: boolean; request: string }) => {
    setIsManualAdding(true);
    const success = await manualAddAttendeeRecord(data, members, attendees);
    if (success) {
      setIsManualAddModalOpen(false);
    }
    setIsManualAdding(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    importAttendeesFile(file, attendees, members, () => {
      setImporting(false);
      setGroups([]);
      if (e.target) e.target.value = '';
    });
  };

  const clearRecords = async () => {
    const success = await clearAllAttendees(attendees);
    if (success) {
      setGroups([]);
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

  const handleAutoAssign = () => {
    const availableAttendees = attendees.filter(a => {
      const isAssigned = groups.some(g => g.memberIds.includes(a.id));
      const m = getMember(a.id);
      return !isAssigned && !!m;
    });

    if (availableAttendees.length === 0) {
      toast.error('배정 가능한 미배정 인원이 없습니다.');
      return;
    }

    const availableMembers = availableAttendees.map(a => ({
      ...a,
      member: getMember(a.id)!
    }));

    const { updatedGroups } = simulateAutoAssign(
      availableMembers,
      groups,
      getMember,
      costContext,
      false
    );

    setGroups(groups.map(g => {
       const wg = updatedGroups.find(w => w.id === g.id);
       return wg ? { ...g, memberIds: wg.memberIds } : g;
    }));
    setIsAutoMode(false);
    toast.success('논리적 균형 배치 알고리즘으로 자동 편성되었습니다.');
  };

  const exportSimulationData = () => {
    if (groups.length === 0) {
      toast.error('조가 없습니다. 조를 생성한 뒤 시뮬레이션을 실행해주세요.');
      return;
    }

    toast.info('시뮬레이션을 시작합니다. 브라우저가 잠시 멈출 수 있습니다...');
    setTimeout(() => {
      const availableAttendees = attendees.filter(a => {
        const isAssigned = groups.some(g => g.memberIds.includes(a.id));
        const m = getMember(a.id);
        return !isAssigned && !!m;
      });

      const availableMembers = availableAttendees.map(a => ({
        ...a,
        member: getMember(a.id)!
      }));

      const { costLog, actualCost } = simulateAutoAssign(
        availableMembers,
        groups,
        getMember,
        costContext,
        true
      );

      const simulationHistory = costLog || [];
      const maxRewardFound = simulationHistory.length > 0 ? Math.max(...simulationHistory.map(s => s.reward)) : 0;
      const raw_valid_costs = simulationHistory.filter(s => s.reward === maxRewardFound).map(s => s.pureCost);

      const report = {
        session_id: sessionDate,
        actual_cost: actualCost,
        valid_count: raw_valid_costs.length,
        raw_valid_costs
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulation_${sessionDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('데이터 결과가 다운로드되었습니다.');
    }, 100);
  };

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

  const handleDragStart = (e: React.DragEvent, memberId: string, source: string) => {
    e.dataTransfer.setData('memberId', memberId);
    e.dataTransfer.setData('source', source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('memberId');
    const source = e.dataTransfer.getData('source');

    if (!memberId || source === targetGroupId) return;

    if (source === 'unassigned') {
      assignToGroup(memberId, targetGroupId);
    } else {
      setGroups(prev => prev.map(g => {
        if (g.id === source) return { ...g, memberIds: g.memberIds.filter(id => id !== memberId) };
        if (g.id === targetGroupId) return { ...g, memberIds: Array.from(new Set([...g.memberIds, memberId])) };
        return g;
      }));
    }
  };

  const handleDropToUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('memberId');
    const source = e.dataTransfer.getData('source');

    if (!memberId || source === 'unassigned') return;
    removeFromGroup(memberId, source);
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
    const result = await runAction('attendance-save', async () => {
      const planningRef = doc(db, 'DailyPlannings', sessionDate);
      const planningSnapshot = await getDoc(planningRef);
      const sessionId = resolveDailySessionId({
        planningSessionId: planningSnapshot.data()?.sessionId,
        sessions,
        sessionDate,
        sessionName,
      });
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnapshot = await getDoc(sessionRef);
      const batch = writeBatch(db);

      attendees.forEach(a => {
        batch.update(doc(db, 'attendees', a.id), { status: '편성됨' });
      });

      batch.set(planningRef, {
        name: sessionName,
        date: sessionDate,
        groups: mappedGroups,
        sessionId,
        createdAt: planningSnapshot.exists() ? planningSnapshot.data().createdAt : serverTimestamp(),
      }, { merge: true });

      if (!sessionSnapshot.exists()) {
        batch.set(sessionRef, {
          name: sessionName,
          date: Timestamp.fromDate(new Date(sessionDate)),
          groups: mappedGroups,
          boardMemberIds: members.filter(member => member.isBoardMember).map(member => member.id),
        });
      }

      addAuditEventToBatch(batch, {
        category: 'session',
        action: 'session.meeting_started',
        targetId: sessionId,
        targetLabel: sessionName,
        count: assignedAttendees.length,
        detail: `${sessionDate} · ${mappedGroups.length}개 조 · 배정 ${assignedAttendees.length}명`,
      });

      await batch.commit();
    }, {
      successMessage: '모임을 시작하고 세션 기록을 저장했습니다.',
      errorMessage: '모임과 세션 기록을 저장하지 못했습니다.',
      onError: (error) => handleFirestoreError(error, OperationType.WRITE, `DailyPlannings/${sessionDate}`),
    });
    if (result.succeeded && onMoveToRecord) {
      onMoveToRecord();
    }
  };

  return {
    attendees,
    members,
    sessions,
    importing,
    activeRequestId,
    setActiveRequestId,
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
    calculateGroupAverageAttendance: calcGroupAvgAttendance,
    calculateGroupAverageStudentId: calcGroupAvgStudentId,
    getReunionWarnings: getWarnings,
    assignedAttendeeIds,
    unassignedAttendees,

    handleDeleteAttendee,
    handleQuickAddMember,
    handleManualAdd,
    handleFileUpload,
    clearRecords,
    handleCreateGroup,
    handleUpdateTargetSize,
    handleAutoAssign,
    exportSimulationData,

    assignToGroup,
    removeFromGroup,
    handleDragStart,
    handleDragOver,
    handleDropToGroup,
    handleDropToUnassigned,
    handleMoveToRecord,
    attendanceSaving: isPending('attendance-save'),
  };
}
