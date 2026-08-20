import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  addDoc, 
  updateDoc,
  collection, 
  orderBy, 
  Timestamp,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, Member, Game, StoredSessionGroup } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';
import { getSemester } from '../domain/semester/getSemester';
import { DragEndEvent } from '@dnd-kit/core';
import { commitBatchesInChunks } from '../lib/chunkBatch';

export function useSessionsLogic(
  draftSession?: { name: string, date: string, groups: StoredSessionGroup[] } | null,
  onClearDraft?: () => void
) {
  const { data: sessions } = useFirestore<Session>('sessions', orderBy('date', 'desc'));
  const { data: members } = useFirestore<Member>('members');
  const { data: games } = useFirestore<Game>('games', orderBy('title', 'asc'));
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState(`${new Date().toLocaleDateString()} 정기 모임`);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [groups, setGroups] = useState<StoredSessionGroup[]>([]);
  const [initialGroups, setInitialGroups] = useState<StoredSessionGroup[] | null>(null);
  const [unassignedIds, setUnassignedIds] = useState<string[]>([]);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>('전체');
  const [isImporting, setIsImporting] = useState(false);

  const cleanString = (str?: string) => (str || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          const hasSnapshotColumns = results.meta.fields?.includes('세션명') ?? false;
          
          const missingGames = new Set<string>();
          rows.forEach(row => {
            const playedGamesStr = row['플레이한 게임들'] || '';
            const playedGames = playedGamesStr.split(',').map(g => g.trim()).filter(Boolean);
            
            playedGames.forEach(gameName => {
              const matchedGame = games.find(g => cleanString(g.title) === cleanString(gameName));
              if (!matchedGame) {
                missingGames.add(gameName);
              }
            });
          });

          if (missingGames.size > 0) {
            toast.error(`다음 게임이 라이브러리에 없습니다: ${Array.from(missingGames).join(', ')}`);
            setIsImporting(false);
            if (e.target) e.target.value = '';
            return;
          }

          const sessionsMap = new Map<string, {
            date: string;
            name: string;
            groups: StoredSessionGroup[];
            boardMemberIds: Set<string>;
          }>();

          rows.forEach(row => {
            const date = (row['날짜'] || '').trim();
            const name = (row['세션명'] || '').trim() || `${date} 정기 모임`;
            if (!date) return;
            const sessionKey = `${date}\u0000${name}`;
            
            if (!sessionsMap.has(sessionKey)) {
              sessionsMap.set(sessionKey, { date, name, groups: [], boardMemberIds: new Set() });
            }
            
            const groupName = (row['조 이름'] || '').trim();
            const memberNamesStr = row['조원 명단'] || row['조원 명단(닉네임)'] || '';
            const memberTokens = memberNamesStr.split(',').map(m => m.trim()).filter(Boolean);
            const playedGamesStr = row['플레이한 게임들'] || '';
            const playedGames = playedGamesStr.split(',').map(g => g.trim()).filter(Boolean);
            const currentSession = sessionsMap.get(sessionKey)!;
            
            const groupMemberIds: string[] = [];
            memberTokens.forEach(token => {
              const isBoardMember = /\(임원\)|👑|\*$/.test(token);
              const cleanToken = token.replace(/\(임원\)|👑|\*/g, '').trim();
              const normalizedToken = cleanString(cleanToken);
              const normalizedName = normalizedToken.replace(/^\d{2}/, '');
              const matchedMember = members.find(member =>
                member.nickname === cleanToken
                || member.name === cleanToken
                || cleanString(member.nickname) === normalizedToken
                || cleanString(member.name) === normalizedToken
                || cleanString(member.name).replace(/^\d{2}/, '') === normalizedName
              );
              if (matchedMember) {
                groupMemberIds.push(matchedMember.id);
                if (isBoardMember) currentSession.boardMemberIds.add(matchedMember.id);
              }
            });

            const groupGameIds = playedGames.map(gameName => {
              const matchedGame = games.find(g => cleanString(g.title) === cleanString(gameName));
              return matchedGame ? matchedGame.id : null;
            }).filter(Boolean) as string[];

            currentSession.groups.push({
              id: Math.random().toString(36).substring(7),
              name: groupName,
              memberIds: groupMemberIds,
              gameIds: groupGameIds,
              targetSize: groupMemberIds.length > 0 ? groupMemberIds.length : 4,
              notes: ''
            });
          });

          const operations: Parameters<typeof commitBatchesInChunks>[1] = [];
          sessionsMap.forEach(sessionData => {
            const docRef = doc(collection(db, 'sessions'));
            const data: Omit<Session, 'id'> = {
              name: sessionData.name,
              date: Timestamp.fromDate(new Date(sessionData.date)),
              groups: sessionData.groups,
              ...(hasSnapshotColumns ? { boardMemberIds: Array.from(sessionData.boardMemberIds) } : {}),
            };
            operations.push({
              type: 'set',
              ref: docRef,
              data
            });
          });

          await commitBatchesInChunks(db, operations);
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

  useEffect(() => {
    if (draftSession) {
      setSessionName(draftSession.name);
      setSessionDate(draftSession.date);
      setGroups(draftSession.groups);
      
      const assignedIds = draftSession.groups.flatMap(g => g.memberIds) as string[];
      setUnassignedIds(members.filter(m => !assignedIds.includes(m.id)).map(m => m.id));
      
      setEditingSessionId(null);
      setIsAdding(true);

      if (onClearDraft) onClearDraft();
    }
  }, [draftSession, members, onClearDraft]);

  const handleAddNew = () => {
    setUnassignedIds(members.map(m => m.id));
    setGroups([]);
    setSessionName(`${new Date().toLocaleDateString()} 정기 모임`);
    setSessionDate(new Date().toISOString().split('T')[0] ?? '');
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
    setUnassignedIds(prev => prev.filter(id => id !== memberId));
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, memberIds: Array.from(new Set([...g.memberIds, memberId])) } : g
    ));
  };

  const removeFromGroup = (memberId: string, groupId: string) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== memberId) } : g
    ));
    setUnassignedIds(prev => prev.includes(memberId) ? prev : [...prev, memberId]);
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
    try {
      if (groups.length === 0) {
        toast.error('최소 한 개의 조를 생성해야 합니다.');
        return;
      }

      const sanitizedGroups = groups.map(g => ({
        id: g.id,
        name: g.name || '',
        memberIds: g.memberIds || [],
        targetSize: g.targetSize || 0,
        gameIds: g.gameIds || [],
        notes: g.notes || ''
      }));

      if (editingSessionId) {
        const docRef = doc(db, 'sessions', editingSessionId);
        const docSnap = await getDoc(docRef);

        let finalGroups: StoredSessionGroup[] = sanitizedGroups;

        if (docSnap.exists()) {
          const currentData = docSnap.data() as Session;
          const currentGroups = currentData.groups || [];

          if (initialGroups) {
            finalGroups = [...currentGroups];

            const initialIds = initialGroups.map(g => g.id);
            const currentOurIds = sanitizedGroups.map(g => g.id);
            const deletedIds = initialIds.filter(id => !currentOurIds.includes(id));

            // Delete groups that we removed
            finalGroups = finalGroups.filter(g => !deletedIds.includes(g.id));

            // Update or add groups
            sanitizedGroups.forEach(myGroup => {
              const initGroup = initialGroups.find(g => g.id === myGroup.id);
              const dbIndex = finalGroups.findIndex(g => g.id === myGroup.id);

              if (!initGroup) {
                // Newly added group
                if (dbIndex === -1) {
                  finalGroups.push(myGroup);
                } else {
                  finalGroups[dbIndex] = myGroup;
                }
              } else {
                // Check if we modified the group
                const isChanged = JSON.stringify(initGroup) !== JSON.stringify(myGroup);
                if (isChanged) {
                  if (dbIndex !== -1) {
                    finalGroups[dbIndex] = myGroup;
                  } else {
                    finalGroups.push(myGroup);
                  }
                }
              }
            });
          }
        }

        const existingBoardMemberIds = docSnap.exists()
          ? (docSnap.data() as Session).boardMemberIds
          : undefined;
        const sessionData = {
          name: sessionName,
          date: Timestamp.fromDate(new Date(sessionDate || '')),
          groups: finalGroups,
          ...(existingBoardMemberIds !== undefined ? { boardMemberIds: existingBoardMemberIds } : {}),
        };

        await updateDoc(docRef, sessionData);
        toast.success('세션 기록이 성공적으로 수정되었습니다.');
      } else {
        const sessionData = {
          name: sessionName,
          date: Timestamp.fromDate(new Date(sessionDate || '')),
          groups: sanitizedGroups,
          boardMemberIds: members.filter(member => member.isBoardMember).map(member => member.id),
        };
        await addDoc(collection(db, 'sessions'), sessionData);
        toast.success('신규 세션이 성공적으로 저장되었습니다.');
      }

      handleClose();
    } catch (error) {
      handleFirestoreError(error, editingSessionId ? OperationType.UPDATE : OperationType.CREATE, `sessions/${editingSessionId || ''}`);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleEdit = (session: Session) => {
    setEditingSessionId(session.id);
    setSessionName(session.name || '');
    setSessionDate(session.date?.toDate
      ? (session.date.toDate().toISOString().split('T')[0] ?? '')
      : (new Date().toISOString().split('T')[0] ?? ''));

    const mappedGroups = session.groups.map(g => ({
      id: g.id || Math.random().toString(36).substring(7),
      name: g.name,
      memberIds: g.memberIds || [],
      targetSize: g.targetSize,
      gameIds: g.gameIds || [],
      notes: g.notes || ''
    } as StoredSessionGroup));

    setGroups(mappedGroups);
    setInitialGroups(JSON.parse(JSON.stringify(mappedGroups)));

    // Find who is NOT in any group
    const assignedIds = session.groups.flatMap(g => g.memberIds) as string[];
    setUnassignedIds(members.filter(m => !assignedIds.includes(m.id)).map(m => m.id));
    
    setIsAdding(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'sessions', itemToDelete.id));
      toast.success('세션 기록이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${itemToDelete.id}`);
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleClose = () => {
    setIsAdding(false);
    setEditingSessionId(null);
    setGroups([]);
    setInitialGroups(null);
    setUnassignedIds([]);
  };

  return {
    sessions, members, games,
    isAdding, setIsAdding,
    editingSessionId, setEditingSessionId,
    sessionName, setSessionName,
    sessionDate, setSessionDate,
    groups, setGroups,
    unassignedIds, setUnassignedIds,
    viewingMember, setViewingMember,
    itemToDelete, setItemToDelete,
    selectedSemester, setSelectedSemester,
    isImporting, setIsImporting,
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
    handleClose
  };
}
