import React, { useState, useMemo } from 'react';
import { 
  writeBatch, 
  doc, 
  orderBy,
  setDoc,
  serverTimestamp,
  increment,
  Firestore,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Attendee, Member, SessionGroup, StoredSessionGroup, Session, MemberId } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';

import { getMemberFromAttendee } from '../domain/matching/getMemberFromAttendee';
import { 
  deleteAttendeeRecord, 
  quickAddMemberRecord, 
  manualAddAttendeeRecord, 
  importAttendeesFile, 
  clearAllAttendees,
  syncMeetingAttendeesFromSheet 
} from '../services/attendeesService';
import { simulateAutoAssign } from '../domain/matching/autoAssignAlgorithm';
import {
  calculateGroupAverageAttendance,
  calculateGroupAverageStudentId,
  getReunionWarnings
} from '../domain/attendance/attendanceHelpers';
import { getDefaultSessionName, getTodaySessionMetadata } from '../domain/attendance/sessionMetadata';
import { getActivity, getExperience, CostCalculationContext } from '../domain/matching/groupCostFunction';
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

export async function executeMoveToRecordBatch(
  database: Firestore,
  attendeesList: Attendee[],
  groupsList: SessionGroup[],
  membersList: Member[],
  sessionNameStr: string,
  sessionDateStr: string,
  callerEmail: string = 'admin',
  batchFactory = writeBatch,
  docFn = doc,
  setDocFn = setDoc
): Promise<{ success: boolean; mappedGroups: StoredSessionGroup[]; error?: unknown }> {
  const assignedAttendees = groupsList.flatMap(g => g.memberIds.map(id => attendeesList.find(a => a.id === id)).filter(Boolean) as Attendee[]);
  const unregistered = assignedAttendees.filter(a => !getMemberFromAttendee(membersList, a.name, a.studentIdPrefix));
  
  if (unregistered.length > 0) {
    return { success: false, mappedGroups: [], error: 'UNREGISTERED_MEMBERS' };
  }

  const batch = batchFactory(database);
  attendeesList.forEach(a => {
    batch.update(docFn(database, 'attendees', a.id), { status: '편성됨' });
  });

  // Atomically bump attendance revision
  const revRef = docFn(database, 'system_settings', 'attendance_revision');
  batch.set(
    revRef,
    {
      revision: increment(1),
      lastUpdatedAt: serverTimestamp(),
      updatedBy: callerEmail,
    },
    { merge: true }
  );

  const mappedGroups = convertAttendeeIdsToMemberIds(groupsList, attendeesList, membersList);

  await batch.commit();

  await setDocFn(docFn(database, 'DailyPlannings', sessionDateStr || 'temp'), {
    name: sessionNameStr,
    date: sessionDateStr,
    groups: mappedGroups,
    createdAt: serverTimestamp()
  });

  return { success: true, mappedGroups };
}

interface UseAttendanceLogicProps {
  onMoveToRecord?: (draft: { name: string, date: string, groups: StoredSessionGroup[] }) => void;
}

export function useAttendanceLogic({ onMoveToRecord }: UseAttendanceLogicProps) {
  const { data: attendees } = useFirestore<Attendee>('attendees', orderBy('importDate', 'desc'));
  const { data: members } = useFirestore<Member>('members');
  const { data: sessions } = useFirestore<Session>('sessions', orderBy('date', 'desc'));

  const [importing, setImporting] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
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

  const getMember = (attendeeId: string) => {
    const a = attendees.find(x => x.id === attendeeId);
    if (!a) return undefined;
    return getMemberFromAttendee(members, a.name, a.studentIdPrefix);
  };

  const getMemberFromInfo = (name?: string, studentIdPrefix?: string) => {
    return getMemberFromAttendee(members, name, studentIdPrefix);
  };

  const participationHistory = useMemo(() => {
    return getParticipationHistory(members, sessions, sessionDate || '9999-99-99');
  }, [members, sessions, sessionDate]);

  const memberAttendanceCount = participationHistory.attendanceCounts;

  const memberPairLastSession = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (sessions.length > 0 && sessions[0]) {
      sessions[0].groups.forEach(g => {
        for (let i = 0; i < g.memberIds.length; i++) {
          for (let j = i + 1; j < g.memberIds.length; j++) {
            const pairKey = [g.memberIds[i], g.memberIds[j]].sort().join('|');
            map[pairKey] = true;
          }
        }
      });
    }
    return map;
  }, [sessions]);

  const memberPairRecentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.slice(0, 3).forEach(s => {
      s.groups.forEach(g => {
        for (let i = 0; i < g.memberIds.length; i++) {
          for (let j = i + 1; j < g.memberIds.length; j++) {
            const pairKey = [g.memberIds[i], g.memberIds[j]].sort().join('|');
            map[pairKey] = (map[pairKey] || 0) + 1;
          }
        }
      });
    });
    return map;
  }, [sessions]);

  const assignedAttendeeIds = useMemo(() => {
    return new Set(groups.flatMap(g => g.memberIds));
  }, [groups]);

  const calcGroupAvgAttendance = (attendeeIds: string[]) => 
    calculateGroupAverageAttendance(attendeeIds, getMember, memberAttendanceCount);

  const calcGroupAvgStudentId = (attendeeIds: string[]) => 
    calculateGroupAverageStudentId(attendeeIds, getMember, attendees);

  const unassignedAttendees = attendees
    .filter(a => !assignedAttendeeIds.has(a.id))
    .sort((a, b) => {
      const getPrefixNumber = (prefix?: string) => {
        if (!prefix) return 999;
        const num = parseInt(prefix, 10);
        return isNaN(num) ? 999 : num;
      };
      const prefixDiff = getPrefixNumber(a.studentIdPrefix) - getPrefixNumber(b.studentIdPrefix);
      if (prefixDiff !== 0) return prefixDiff;
      return a.name.localeCompare(b.name);
    });

  const getWarnings = (attendeeIds: string[]) => 
    getReunionWarnings(attendeeIds, getMember, memberPairRecentCounts);

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
    setIsManualAdding(false);
    if (success) {
      setIsManualAddModalOpen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    importAttendeesFile(file, attendees, members, () => {
      setImporting(false);
      if (e.target) e.target.value = '';
    });
  };

  const handleSyncSheet = async () => {
    setSyncingSheet(true);
    try {
      await syncMeetingAttendeesFromSheet(attendees, members, {
        onManualModificationDetected: (proceed) => {
          if (window.confirm('출석 명단에 수동으로 수정/추가된 기록이 있습니다. Google Sheet로 다시 덮어쓰시겠습니까?')) {
            proceed();
          }
        },
        onZeroAttendeesDetected: (proceed) => {
          if (window.confirm('가져온 출석 인원이 0명입니다. 정말로 모든 출석 명단을 비우시겠습니까?')) {
            proceed();
          }
        },
        onAssignedAttendeesDetected: (proceed) => {
          if (window.confirm('이미 조편성이 진행된 상태입니다. 다시 불러오면 현재 조편성 상태가 초기화됩니다. 계속 진행하시겠습니까?')) {
            proceed();
          }
        },
      });
    } finally {
      setSyncingSheet(false);
    }
  };

  const clearRecords = async () => {
    if (attendees.length === 0) return;
    if (window.confirm('현재 대기 중인 모든 출석 명단을 초기화하시겠습니까?')) {
      const success = await clearAllAttendees(attendees);
      if (success) {
        setGroups([]);
      }
    }
  };

  const handleCreateGroup = () => {
    const newId = `group-${Date.now()}`;
    setGroups(prev => [
      ...prev,
      {
        id: newId,
        name: `${prev.length + 1}조`,
        memberIds: [],
        gameIds: [],
        targetSize: 4
      }
    ]);
  };

  const handleUpdateTargetSize = (groupId: string, targetSize: number) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, targetSize } : g));
  };

  const exportSimulationData = () => {
    const totalMems = attendees.map(a => getMember(a.id)).filter(Boolean) as Member[];
    const avgTotalAtt = totalMems.reduce((acc, m) => acc + (memberAttendanceCount[m.id] || 0), 0) / (totalMems.length || 1);
    
    let totalAssigned = 0;
    let totalTarget = 0;
    let totalVariance = 0;
    let totalRecentReunions = 0;
    let totalLastSessionReunions = 0;
    let totalGenderPenalties = 0;

    groups.forEach(g => {
      const gMems = g.memberIds.map(id => getMember(id)).filter(Boolean) as Member[];
      totalAssigned += g.memberIds.length;
      totalTarget += (g.targetSize || 4);
      
      const gAvgAtt = gMems.reduce((acc, m) => acc + (memberAttendanceCount[m.id] || 0), 0) / (gMems.length || 1);
      totalVariance += Math.pow(gAvgAtt - avgTotalAtt, 2);

      for (let i = 0; i < gMems.length; i++) {
        for (let j = i + 1; j < gMems.length; j++) {
          const pairKey = [gMems[i]?.id, gMems[j]?.id].sort().join('|');
          if (memberPairRecentCounts[pairKey]) totalRecentReunions += memberPairRecentCounts[pairKey];
          if (memberPairLastSession[pairKey]) totalLastSessionReunions++;
        }
      }

      const females = gMems.filter(m => m.gender === '여').length;
      if (females === 1) totalGenderPenalties += 1;
    });

    const metrics = {
      timestamp: new Date().toISOString(),
      sessionDate,
      totalAttendees: attendees.length,
      totalGroups: groups.length,
      capacityDeviation: Math.abs(totalAssigned - totalTarget),
      attendanceVariance: totalVariance / (groups.length || 1),
      recentReunions: totalRecentReunions,
      lastSessionReunions: totalLastSessionReunions,
      isolatedFemalePenalty: totalGenderPenalties,
      details: groups.map(g => ({
        name: g.name,
        targetSize: g.targetSize,
        size: g.memberIds.length,
        members: g.memberIds.map(id => {
          const m = getMember(id);
          const att = attendees.find(a => a.id === id);
          return {
            name: att?.name,
            studentIdPrefix: att?.studentIdPrefix,
            gender: m?.gender,
            attendanceCount: m ? (memberAttendanceCount[m.id] || 0) : 0,
            experience: m ? getExperience(memberAttendanceCount[m.id] || 0) : 0,
            activity: m ? getActivity(participationHistory.currentSemesterAttendanceCounts[m.id] || 0, participationHistory.currentSemesterOpportunityCounts[m.id] || 0) : 0
          };
        })
      }))
    };

    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `group-simulation-${sessionDate || 'today'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('시뮬레이션 데이터가 JSON 파일로 다운로드되었습니다.');
  };

  const handleAutoAssign = () => {
    const availableAttendeesWithMember: (Attendee & { member: Member })[] = [];

    attendees.forEach(a => {
      const member = getMemberFromInfo(a.name, a.studentIdPrefix);
      if (member) {
        availableAttendeesWithMember.push({ ...a, member });
      }
    });

    if (availableAttendeesWithMember.length === 0) {
      toast.error('편성 가능한 등록 회원이 없습니다.');
      return;
    }

    const memberExperience: Record<string, number> = {};
    const memberActivity: Record<string, number> = {};
    let sumExp = 0;
    let sumAct = 0;

    availableAttendeesWithMember.forEach(a => {
      const exp = getExperience(memberAttendanceCount[a.member.id] || 0);
      const act = getActivity(
        participationHistory.currentSemesterAttendanceCounts[a.member.id] || 0,
        participationHistory.currentSemesterOpportunityCounts[a.member.id] || 0
      );
      memberExperience[a.member.id] = exp;
      memberActivity[a.member.id] = act;
      sumExp += exp;
      sumAct += act;
    });

    const femaleCount = availableAttendeesWithMember.filter(a => a.member.gender === '여').length;
    const overallGenderRatio = femaleCount / (availableAttendeesWithMember.length || 1);

    const years = availableAttendeesWithMember.map(a => {
      const parsed = parseInt(a.member.studentId?.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(x => x) || '25', 10);
      return isNaN(parsed) ? 25 : parsed;
    });
    const avgYear = years.reduce((acc, y) => acc + y, 0) / (years.length || 1);
    const vPool = years.reduce((acc, y) => acc + Math.pow(y - avgYear, 2), 0) / (years.length || 1);

    const ctx: CostCalculationContext = {
      overallGenderRatio,
      vPool,
      memberExperience,
      memberActivity,
      overallExperienceAverage: sumExp / (availableAttendeesWithMember.length || 1),
      overallActivityAverage: sumAct / (availableAttendeesWithMember.length || 1),
      memberPairRecentCounts,
      memberPairLastSession,
      requestedPairs: [],
    };

    const autoAssignRes = simulateAutoAssign(
      availableAttendeesWithMember,
      groups,
      getMember,
      ctx
    );

    setGroups(autoAssignRes.updatedGroups);
    setIsAutoMode(true);
    toast.success('최적화된 알고리즘으로 조편성이 완료되었습니다!');
  };

  const assignToGroup = (attendeeId: string, targetGroupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === targetGroupId) {
        if (g.memberIds.includes(attendeeId)) return g;
        return { ...g, memberIds: [...g.memberIds, attendeeId] };
      }
      return { ...g, memberIds: g.memberIds.filter(id => id !== attendeeId) };
    }));
  };

  const removeFromGroup = (attendeeId: string, fromGroupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === fromGroupId) {
        return { ...g, memberIds: g.memberIds.filter(id => id !== attendeeId) };
      }
      return g;
    }));
  };

  const handleDragStart = (e: React.DragEvent, memberId: string, source: string) => {
    e.dataTransfer.setData('memberId', memberId);
    e.dataTransfer.setData('source', source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('memberId');
    const source = e.dataTransfer.getData('source');
    
    if (!memberId || source === targetGroupId) return;
    assignToGroup(memberId, targetGroupId);
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

    try {
      const res = await executeMoveToRecordBatch(
        db,
        attendees,
        groups,
        members,
        sessionName,
        sessionDate,
        auth.currentUser?.email || 'admin'
      );

      if (!res.success) {
        if (res.error === 'UNREGISTERED_MEMBERS') {
          toast.error('미등록 인원이 포함되어 있습니다. 먼저 조원 카드에서 추가해주세요!');
        }
        return;
      }

      toast.success('오늘의 모임 편성이 저장되었습니다.');
      
      if (sessionName && sessionDate && onMoveToRecord) {
        onMoveToRecord({
          name: sessionName,
          date: sessionDate,
          groups: res.mappedGroups
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
    syncingSheet,
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
    handleSyncSheet,
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
