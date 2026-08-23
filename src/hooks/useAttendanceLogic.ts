import React, { useState, useMemo } from 'react';
import {
  writeBatch,
  doc,
  orderBy,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Attendee, Member, SessionGroup, StoredSessionGroup, Session, MemberId } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';

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
import { getActivity, getExperience } from '../domain/matching/groupCostFunction';
import { getParticipationHistory } from '../domain/matching/participationHistory';

export function convertAttendeeIdsToMemberIds(
  groups: SessionGroup[],
  attendees: Attendee[],
  members: Member[]
): StoredSessionGroup[] {
  const getMemberFromInfo = (name?: string, studentIdPrefix?: string) => {
    return getMemberFromAttendee(members, name, studentIdPrefix);
  };

  return groups.map(g => ({
    ...g,
    memberIds: g.memberIds.map(aId => {
      const a = attendees.find(x => x.id === aId);
      const m = getMemberFromInfo(a?.name, a?.studentIdPrefix);
      return (m ? m.id : aId) as MemberId;
    })
  }));
}

interface UseAttendanceLogicProps {
  onMoveToRecord?: (draft: { name: string, date: string, groups: StoredSessionGroup[] }) => void;
}

export function useAttendanceLogic({ onMoveToRecord }: UseAttendanceLogicProps) {
  const { data: attendees } = useFirestore<Attendee>('attendees', orderBy('importDate', 'desc'));
  const { data: members } = useFirestore<Member>('members');
  const { data: sessions } = useFirestore<Session>('sessions', orderBy('date', 'desc'));

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

  const memberPairLastSession = useMemo(() => {
    const pairs: Record<string, boolean> = {};
    if (sessions.length > 0 && sessions[0]) {
      const lastSession = sessions[0];
      lastSession.groups.forEach(g => {
        for (let i = 0; i < g.memberIds.length; i++) {
          for (let j = i + 1; j < g.memberIds.length; j++) {
            const pairKey = [g.memberIds[i], g.memberIds[j]].sort().join('|');
            pairs[pairKey] = true;
          }
        }
      });
    }
    return pairs;
  }, [sessions]);

  const memberPairRecentCounts = useMemo(() => {
    const pairs: Record<string, number> = {};
    const recentSessions = sessions.slice(0, 3);
    recentSessions.forEach(s => {
      s.groups.forEach(g => {
        for (let i = 0; i < g.memberIds.length; i++) {
          for (let j = i + 1; j < g.memberIds.length; j++) {
            const pairKey = [g.memberIds[i], g.memberIds[j]].sort().join('|');
            pairs[pairKey] = (pairs[pairKey] || 0) + 1;
          }
        }
      });
    });
    return pairs;
  }, [sessions]);

  const calcGroupAvgAttendance = (attendeeIds: string[]) => calculateGroupAverageAttendance(attendeeIds, getMember, memberAttendanceCount);
  const calcGroupAvgStudentId = (attendeeIds: string[]) => calculateGroupAverageStudentId(attendeeIds, getMember, attendees);
  const getWarnings = (attendeeIds: string[]) => getReunionWarnings(attendeeIds, getMember, memberPairRecentCounts);

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

  const getCostContext = () => {
    const totalMems = attendees.map(a => getMember(a.id)).filter(Boolean) as Member[];
    const totalCount = totalMems.length || 1;
    const overallGenderRatio = totalCount > 0 ? totalMems.filter(m => m.gender === '여').length / totalCount : 0;
    const globalYears = totalMems.map(m => parseInt(m.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x=>x) || '25'));
    const globalAvgYear = globalYears.reduce((a, b) => a + b, 0) / (globalYears.length || 1);
    let vPool = 0;
    if (globalYears.length > 0) {
      vPool = globalYears.reduce((a, b) => a + Math.pow(b - globalAvgYear, 2), 0) / globalYears.length;
    }

    const participationHistory = getParticipationHistory(totalMems, sessions, sessionDate);
    const memberExperience: Record<string, number> = {};
    const memberActivity: Record<string, number> = {};

    totalMems.forEach(member => {
      memberExperience[member.id] = getExperience(participationHistory.attendanceCounts[member.id] || 0);
      memberActivity[member.id] = getActivity(
        participationHistory.currentSemesterAttendanceCounts[member.id] || 0,
        participationHistory.currentSemesterOpportunityCounts[member.id] || 0
      );
    });

    const overallExperienceAverage = totalMems.length > 0
      ? totalMems.reduce((sum, member) => sum + memberExperience[member.id]!, 0) / totalMems.length
      : 0;
    const overallActivityAverage = totalMems.length > 0
      ? totalMems.reduce((sum, member) => sum + memberActivity[member.id]!, 0) / totalMems.length
      : 0.5;

    const requestedPairs: {a: string, b: string}[] = [];
    attendees.forEach(attA => {
      if (attA.request) {
        const memA = getMember(attA.id);
        if (!memA) return;
        members.forEach(memB => {
          if (memA.id !== memB.id && attA.request!.includes(memB.name)) {
            requestedPairs.push({ a: memA.id, b: memB.id });
          }
        });
      }
    });

    return {
      overallGenderRatio,
      vPool,
      memberExperience,
      memberActivity,
      overallExperienceAverage,
      overallActivityAverage,
      memberPairRecentCounts,
      memberPairLastSession,
      requestedPairs,
    };
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

    const ctx = getCostContext();

    const { updatedGroups } = simulateAutoAssign(
      availableMembers,
      groups as SessionGroup[],
      getMember,
      ctx,
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
      const ctx = getCostContext();

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
        groups as SessionGroup[],
        getMember,
        ctx,
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

    const batch = writeBatch(db);
    attendees.forEach(a => {
      batch.update(doc(db, 'attendees', a.id), { status: '편성됨' });
    });
    await batch.commit().catch((error) => {
      handleFirestoreError(error, OperationType.UPDATE, 'attendees (batch)');
    });

    const mappedGroups = convertAttendeeIdsToMemberIds(groups, attendees, members);

    try {
      await setDoc(doc(db, 'DailyPlannings', sessionDate || 'temp'), {
        name: sessionName,
        date: sessionDate,
        groups: mappedGroups,
        createdAt: serverTimestamp()
      });
      toast.success('오늘의 모임 편성이 저장되었습니다.');

      if (sessionName && sessionDate && onMoveToRecord) {
        onMoveToRecord({
          name: sessionName,
          date: sessionDate,
          groups: mappedGroups
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `DailyPlannings/${sessionDate}`);
      toast.error('오류가 발생했습니다.');
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
    memberPairLastSession,
    memberPairRecentCounts,
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
  };
}
