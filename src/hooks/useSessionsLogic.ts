import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, Member, Game, StoredSessionGroup } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';
import { getSemester } from '../domain/semester/getSemester';
import { DragEndEvent } from '@dnd-kit/core';
import { getTodaySessionMetadata, getLocalDateKey } from '../domain/attendance/sessionMetadata';
import { parseSessionCsvRows } from '../domain/sessions/sessionCsv';
import { normalizeSessionGroup } from '../domain/sessions/sessionGroups';
import { createSessionRecord, deleteSessionRecord, importSessionRecords, updateSessionRecord, updateSessionGroupGames } from '../services/sessionsService';
import { useAsyncActionState } from './useAsyncActionState';

export function useSessionsLogic() {
  const { data: sessions } = useFirestore<Session>('sessions', 'date', 'desc');
  const { data: members } = useFirestore<Member>('members');
  const { data: games } = useFirestore<Game>('games', 'title');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState(() => getTodaySessionMetadata().sessionName);
  const [sessionDate, setSessionDate] = useState(() => getTodaySessionMetadata().sessionDate);
  const [groups, setGroups] = useState<StoredSessionGroup[]>([]);
  const [initialGroups, setInitialGroups] = useState<StoredSessionGroup[] | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>('전체');
  const [isImporting, setIsImporting] = useState(false);
  const { runAction, isPending } = useAsyncActionState();

  const unassignedIds = useMemo(() => {
    const assignedIds = new Set(groups.flatMap(group => group.memberIds));
    return members.filter(member => !assignedIds.has(member.id)).map(member => member.id);
  }, [members, groups]);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const imported = parseSessionCsvRows(
            results.data as Record<string, string>[], results.meta.fields || [], members, games,
          );
          if (imported.missingGames.length > 0) {
            toast.error(`다음 게임이 라이브러리에 없습니다: ${imported.missingGames.join(', ')}`);
            return;
          }
          await importSessionRecords(imported.sessions);
          toast.success('세션 기록이 성공적으로 일괄 추가되었습니다.');
        } catch (error) {
          console.error(error);
          toast.error('CSV 데이터를 처리하는 중 오류가 발생했습니다.');
        } finally {
          setIsImporting(false);
          if (e.target) e.target.value = '';
        }
      },
      error: () => {
        toast.error('CSV 파일 파싱 중 오류가 발생했습니다.');
        setIsImporting(false);
      }
    });
  };

  const availableSemesters = useMemo(() => {
    const sems = new Set<string>();
    sessions.forEach(s => sems.add(getSemester(s.date)));
    return ['전체', ...Array.from(sems).sort().reverse()];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (selectedSemester === '전체') return sessions;
    return sessions.filter(s => getSemester(s.date) === selectedSemester);
  }, [sessions, selectedSemester]);

  const handleAddNew = () => {
    const metadata = getTodaySessionMetadata();
    setGroups([]);
    setInitialGroups(null);
    setSessionName(metadata.sessionName);
    setSessionDate(metadata.sessionDate);
    setEditingSessionId(null);
    setIsAdding(true);
  };

  const handleCreateGroup = () => {
    const newGroup: StoredSessionGroup = {
      id: Math.random().toString(36).substring(7),
      memberIds: [],
      gameIds: [],
      notes: ''
    };
    setGroups([...groups, newGroup]);
  };

  const updateGroupName = (groupId: string, newName: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
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

  const toggleGameInGroup = (gameId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const gameIds = g.gameIds || [];
        const exists = gameIds.includes(gameId);
        return {
          ...g,
          gameIds: exists 
            ? gameIds.filter(t => t !== gameId)
            : [...gameIds, gameId]
        };
      }
      return g;
    }));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const memberId = active.id as string;
    const source = active.data.current?.source;
    const targetGroupId = over.id as string;

    if (!source || source === targetGroupId) return;

    if (targetGroupId === 'unassigned') {
      removeFromGroup(memberId, source);
    } else if (source === 'unassigned') {
      assignToGroup(memberId, targetGroupId);
    } else {
      moveBetweenGroups(memberId, source, targetGroupId);
    }
  };

  const moveBetweenGroups = (memberId: string, sourceGroupId: string, targetGroupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === sourceGroupId) {
        return { ...g, memberIds: g.memberIds.filter(id => id !== memberId) };
      }
      if (g.id === targetGroupId) {
        return { ...g, memberIds: Array.from(new Set([...g.memberIds, memberId])) };
      }
      return g;
    }));
  };

  const handleSave = async () => {
    if (isPending('session-save')) return;
    if (groups.length === 0) {
      toast.error('최소 한 개의 조를 생성해야 합니다.');
      return;
    }
    const isEditing = Boolean(editingSessionId);
    await runAction('session-save', async () => {
      const draft = { name: sessionName, date: sessionDate, groups };
      if (editingSessionId) {
        await updateSessionRecord(editingSessionId, draft, initialGroups);
      } else {
        await createSessionRecord(draft, members.filter(member => member.isBoardMember).map(member => member.id));
      }

      handleClose();
    }, {
      successMessage: isEditing ? '세션 기록이 성공적으로 수정되었습니다.' : '신규 세션이 성공적으로 저장되었습니다.',
      errorMessage: '세션 기록을 저장하지 못했습니다.',
      onError: (error) => handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, `sessions/${editingSessionId || ''}`),
    });
  };

  const handleEdit = (session: Session) => {
    setEditingSessionId(session.id);
    setSessionName(session.name || '');
    setSessionDate(session.date?.toDate
      ? getLocalDateKey(session.date.toDate())
      : getLocalDateKey(new Date()));

    const mappedGroups = session.groups.map(group => normalizeSessionGroup({
      ...group, id: group.id || Math.random().toString(36).substring(7),
    }));

    setGroups(mappedGroups);
    setInitialGroups(mappedGroups);
    setIsAdding(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    if (isPending('session-delete')) return;
    const session = itemToDelete;
    try {
      await runAction('session-delete', () => deleteSessionRecord(session.id), {
        successMessage: '세션 기록이 삭제되었습니다.',
        errorMessage: '세션 기록을 삭제하지 못했습니다.',
        onError: (error) => handleFirestoreError(error, OperationType.DELETE, `sessions/${session.id}`),
      });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleSaveGroupGames = async (sessionId: string, groupId: string, gameIds: string[]) => {
    const result = await runAction('group-games-save', () => updateSessionGroupGames(sessionId, groupId, gameIds), {
      successMessage: '조 게임 기록이 성공적으로 수정되었습니다.',
      errorMessage: '저장 중 오류가 발생했습니다.',
      onError: (error) => handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`),
    });
    return result.succeeded;
  };

  const handleClose = () => {
    setIsAdding(false);
    setEditingSessionId(null);
    setGroups([]);
    setInitialGroups(null);
  };

  return {
    sessions, members, games,
    isAdding,
    editingSessionId,
    sessionName, setSessionName,
    sessionDate, setSessionDate,
    groups, setGroups,
    unassignedIds,
    viewingMember, setViewingMember,
    itemToDelete, setItemToDelete,
    selectedSemester, setSelectedSemester,
    isImporting,
    availableSemesters,
    filteredSessions,
    handleCSVUpload,
    handleAddNew,
    handleCreateGroup,
    updateGroupName,
    assignToGroup,
    removeFromGroup,
    toggleGameInGroup,
    onDragEnd,
    handleSave,
    handleEdit,
    handleDelete,
    handleSaveGroupGames,
    handleClose,
    sessionSaving: isPending('session-save'),
    sessionDeleting: isPending('session-delete'),
    groupGamesSaving: isPending('group-games-save'),
  };
}
