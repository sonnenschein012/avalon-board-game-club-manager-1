import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { 
  doc, 
  collection,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Game, Session } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';
import { commitBatchesInChunks } from '../lib/chunkBatch';
import { useAsyncActionState } from './useAsyncActionState';
import { createGameFormData, type GameFormData } from '../domain/games/gameForm';
import { parseGameCsv } from '../domain/games/gameCsv';
import { collectAuditChanges, type AuditFieldDefinition } from '../domain/audit/auditEvent';
import { addAuditEventToBatch, createAuditEventOperation } from '../services/auditService';

const GAME_AUDIT_FIELDS = [
  { key: 'title', label: '게임명' },
  { key: 'minPlayers', label: '최소 인원' },
  { key: 'maxPlayers', label: '최대 인원' },
  { key: 'bestMinPlayers', label: '추천 최소 인원' },
  { key: 'bestMaxPlayers', label: '추천 최대 인원' },
  { key: 'complexity', label: '난이도' },
  { key: 'genres', label: '장르' },
  { key: 'memo', label: '메모' },
] satisfies ReadonlyArray<AuditFieldDefinition<Game>>;

export function useGamesLogic() {
  const { data: games } = useFirestore<Game>('games', 'title');
  const { data: sessions } = useFirestore<Session>('sessions', 'date', 'desc');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GameFormData>(() => createGameFormData());
  const [importing, setImporting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [difficultyFilter, setDifficultyFilter] = useState('전체');
  const [playerCount, setPlayerCount] = useState<string>('');
  const [playerCountType, setPlayerCountType] = useState<'best' | 'possible'>('best');
  const [sortOrder, setSortOrder] = useState<'이름순' | '인기순'>('이름순');
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const { runAction, isPending } = useAsyncActionState();

  const gamePlayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(session => {
      session.groups?.forEach(group => {
        group.gameIds?.forEach(gameIdOrTitle => {
          counts[gameIdOrTitle] = (counts[gameIdOrTitle] || 0) + 1;
        });
      });
    });
    return counts;
  }, [sessions]);

  const getPlayCount = useCallback((game: Game) => {
    return (gamePlayCounts[game.id] || 0) + (gamePlayCounts[game.title] || 0);
  }, [gamePlayCounts]);

  const filteredGames = useMemo(() => {
    let result = games.filter(g => {
      const matchesSearch = (g.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenre = genreFilter === '전체' || (g.genres && g.genres.includes(genreFilter));
      
      let matchesDifficulty = true;
      if (difficultyFilter !== '전체') {
        const diff = g.complexity || 0;
        if (difficultyFilter === '1점대') matchesDifficulty = diff > 0 && diff < 2.0;
        else if (difficultyFilter === '2점대') matchesDifficulty = diff >= 2.0 && diff < 3.0;
        else if (difficultyFilter === '3점대') matchesDifficulty = diff >= 3.0 && diff < 4.0;
        else if (difficultyFilter === '4점대 이상') matchesDifficulty = diff >= 4.0;
        else if (difficultyFilter === '미평가') matchesDifficulty = diff === 0;
      }
      
      let matchesPlayerCount = true;
      if (playerCount !== '') {
        const count = parseInt(playerCount, 10);
        if (!isNaN(count)) {
          if (playerCountType === 'best') {
            matchesPlayerCount = g.bestMinPlayers != null && g.bestMaxPlayers != null && count >= g.bestMinPlayers && count <= g.bestMaxPlayers;
          } else {
            matchesPlayerCount = g.minPlayers != null && g.maxPlayers != null && count >= g.minPlayers && count <= g.maxPlayers;
          }
        }
      }
      
      return matchesSearch && matchesGenre && matchesPlayerCount && matchesDifficulty;
    });

    if (sortOrder === '인기순') {
      result = result.sort((a, b) => getPlayCount(b) - getPlayCount(a));
    } else {
      result = result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return result;
  }, [games, searchTerm, genreFilter, difficultyFilter, playerCount, playerCountType, sortOrder, getPlayCount]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { games: importedGames, skippedCount, error } = parseGameCsv(results.data, games);
          if (error) {
            toast.error(error === 'empty' ? '데이터가 없습니다.' : '게임명(또는 이름), 최소인원, 최대인원 열은 필수입니다.');
            return;
          }

          const operations: Parameters<typeof commitBatchesInChunks>[1] = importedGames.map(game => ({
            type: 'set',
            ref: doc(collection(db, 'games')),
            data: game,
          }));

          if (operations.length > 0) {
            operations.push(createAuditEventOperation({
              category: 'game',
              action: 'game.imported',
              targetLabel: `게임 ${importedGames.length}개`,
              count: importedGames.length,
              detail: `중복으로 제외 ${skippedCount}개`,
            }));
            await commitBatchesInChunks(db, operations);
            toast.success(`총 ${importedGames.length}개의 게임이 라이브러리에 추가되었습니다.`);
          } else {
            toast.info(skippedCount > 0 ? '이미 모든 게임이 라이브러리에 있습니다.' : '추가할 데이터가 없습니다.');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'games (batch)');
          toast.error('오류가 발생했습니다.');
        } finally {
          setImporting(false);
          e.target.value = '';
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending('game-save')) return;
    const isEditing = Boolean(editingId);
    await runAction('game-save', async () => {
      if (editingId) {
        const previous = games.find(game => game.id === editingId);
        if (!previous) throw new Error('수정할 게임을 찾을 수 없습니다.');
        const batch = writeBatch(db);
        batch.update(doc(db, 'games', editingId), { ...formData });
        const changes = collectAuditChanges(previous, { ...previous, ...formData }, GAME_AUDIT_FIELDS);
        if (changes.length > 0) {
          addAuditEventToBatch(batch, {
            category: 'game',
            action: 'game.updated',
            targetId: editingId,
            targetLabel: formData.title,
            changes,
          });
        }
        await batch.commit();
        setEditingId(null);
      } else {
        const gameRef = doc(collection(db, 'games'));
        const batch = writeBatch(db);
        batch.set(gameRef, formData);
        addAuditEventToBatch(batch, {
          category: 'game',
          action: 'game.created',
          targetId: gameRef.id,
          targetLabel: formData.title,
        });
        await batch.commit();
      }
      setIsAdding(false);
      setFormData(createGameFormData());
    }, {
      successMessage: isEditing ? '게임 정보가 수정되었습니다.' : '신규 게임이 등록되었습니다.',
      errorMessage: '게임을 저장하지 못했습니다.',
      onError: (error) => handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, `games/${editingId || ''}`),
    });
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    if (isPending('game-delete')) return;
    const game = itemToDelete;
    try {
      await runAction('game-delete', async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'games', game.id));
        addAuditEventToBatch(batch, {
          category: 'game',
          action: 'game.deleted',
          targetId: game.id,
          targetLabel: game.title,
        });
        await batch.commit();
      }, {
        successMessage: '게임이 삭제되었습니다.',
        errorMessage: '게임을 삭제하지 못했습니다.',
        onError: (error) => handleFirestoreError(error, OperationType.DELETE, `games/${game.id}`),
      });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    if (isPending('game-delete-all')) return;
    try {
      await runAction('game-delete-all', async () => {
        const operations: Parameters<typeof commitBatchesInChunks>[1] = games.map(game => ({
          type: 'delete',
          ref: doc(db, 'games', game.id),
        }));
        operations.push(createAuditEventOperation({
          category: 'game',
          action: 'game.deleted_all',
          targetLabel: `게임 ${games.length}개`,
          count: games.length,
          detail: games.map(game => game.title).join(', '),
        }));
        await commitBatchesInChunks(db, operations, 400);
      }, {
        successMessage: '모든 게임이 삭제되었습니다.',
        errorMessage: '전체 게임을 삭제하지 못했습니다.',
        onError: (error) => handleFirestoreError(error, OperationType.DELETE, 'games (batch)'),
      });
    } finally {
      setIsDeleteAllModalOpen(false);
    }
  };

  const startAdding = () => {
    setEditingId(null);
    setFormData(createGameFormData());
    setIsAdding(true);
  };

  const startEditing = (game: Game) => {
    setEditingId(game.id);
    setFormData(createGameFormData(game));
    setIsAdding(true);
  };

  return {
    filteredGames,
    isAdding, setIsAdding,
    editingId,
    formData, setFormData,
    importing,
    itemToDelete, setItemToDelete,
    searchTerm, setSearchTerm,
    genreFilter, setGenreFilter,
    difficultyFilter, setDifficultyFilter,
    playerCount, setPlayerCount,
    playerCountType, setPlayerCountType,
    sortOrder, setSortOrder,
    isDeleteAllModalOpen, setIsDeleteAllModalOpen,
    getPlayCount,
    handleFileUpload,
    handleSubmit,
    handleDelete,
    handleDeleteAll,
    startAdding,
    startEditing,
    gameSaving: isPending('game-save'),
    gameDeleting: isPending('game-delete'),
    gamesDeletingAll: isPending('game-delete-all'),
  };
}
