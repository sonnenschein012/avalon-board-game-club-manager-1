import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  collection,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Game, Session } from '../types';
import { toast } from 'sonner';
import { useFirestore } from './useFirestore';

export const AVAILABLE_GENRES = ['카드', '파티', '협상', '전략', '타일', '경매', '추리', '수학', '마피아', '심리', '협력', '주사위', '순발력', '퍼즐', '그림', '기억력', '배팅', '타이쿤', '퀴즈', '단어'];

export function useGamesLogic() {
  const { data: games } = useFirestore<Game>('games', orderBy('title', 'asc'));
  const { data: sessions } = useFirestore<Session>('sessions', orderBy('date', 'desc'));

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 2, bestMaxPlayers: 4, complexity: 1.0, memo: '', genres: [] as string[] });
  const [importing, setImporting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('전체');
  const [difficultyFilter, setDifficultyFilter] = useState('전체');
  const [playerCount, setPlayerCount] = useState<string>('');
  const [playerCountType, setPlayerCountType] = useState<'best' | 'possible'>('best');
  const [sortOrder, setSortOrder] = useState<'이름순' | '인기순'>('이름순');
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

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

  const getPlayCount = (game: Game) => {
    return (gamePlayCounts[game.id] || 0) + (gamePlayCounts[game.title] || 0);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, searchTerm, genreFilter, difficultyFilter, playerCount, playerCountType, sortOrder, gamePlayCounts]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.data.length < 2) {
            toast.error('데이터가 없습니다.');
            setImporting(false);
            return;
          }

          const headers = results.data[0] as string[];
          const titleIdx = headers.indexOf('이름') !== -1 ? headers.indexOf('이름') : headers.indexOf('게임명');
          const minIdx = headers.indexOf('최소인원');
          const maxIdx = headers.indexOf('최대인원');
          const diffIdx = headers.indexOf('난이도(1~5)') !== -1 ? headers.indexOf('난이도(1~5)') : headers.indexOf('난이도');
          const genreIdx = headers.indexOf('장르');
          const bestIdx = headers.indexOf('추천인원');
          const recMinIdx = headers.indexOf('추천최소인원');
          const recMaxIdx = headers.indexOf('추천최대인원');
          const memoIdx = headers.indexOf('메모');

          if (titleIdx === -1 || minIdx === -1 || maxIdx === -1) {
            toast.error('게임명(또는 이름), 최소인원, 최대인원 열은 필수입니다.');
            setImporting(false);
            return;
          }

          const batch = writeBatch(db);
          let addedCount = 0;
          let skippedCount = 0;
          const currentTitles = new Set(games.map(g => g.title));

          for (let i = 1; i < results.data.length; i++) {
            const row = results.data[i] as string[];
            const titleRaw = row[titleIdx];
            if (!titleRaw) continue;

            const title = titleRaw.trim();
            if (!title || currentTitles.has(title)) {
              skippedCount++;
              continue;
            }

            const minPlayers = parseInt(row[minIdx] || '') || 0;
            const maxPlayers = parseInt(row[maxIdx] || '') || 0;
            const complexity = parseFloat(row[diffIdx] || '') || 0;
            const rawGenre = row[genreIdx] || '';
            const genres = rawGenre.includes('/') ? rawGenre.split('/').map(g => g.trim()).filter(Boolean) : rawGenre.split(',').map(g => g.trim()).filter(Boolean);
            const memo = memoIdx !== -1 ? (row[memoIdx] || '').trim() : '';

            let bestMinPlayers = minPlayers;
            let bestMaxPlayers = maxPlayers;

            if (recMinIdx !== -1 && recMaxIdx !== -1 && row[recMinIdx] && row[recMaxIdx]) {
              bestMinPlayers = parseInt(row[recMinIdx] || '') || minPlayers;
              bestMaxPlayers = parseInt(row[recMaxIdx] || '') || maxPlayers;
            } else if (bestIdx !== -1 && row[bestIdx]) {
              const bestRaw = row[bestIdx] || '';
              const matchRange = bestRaw.match(/(\d+)\s*~\s*(\d+)/);
              if (matchRange) {
                bestMinPlayers = parseInt(matchRange[1] || '');
                bestMaxPlayers = parseInt(matchRange[2] || '');
              } else {
                const numbersMatch = bestRaw.match(/\d+/g);
                if (numbersMatch) {
                  const numbers = numbersMatch.map(m => parseInt(m || ''));
                  if (numbers.length === 1 && numbers[0] !== undefined) {
                    bestMinPlayers = numbers[0];
                    bestMaxPlayers = numbers[0];
                  } else if (numbers.length > 1) {
                    bestMinPlayers = Math.min(...numbers);
                    bestMaxPlayers = Math.max(...numbers);
                  }
                }
              }
            }

            const docRef = doc(collection(db, 'games'));
            batch.set(docRef, { title, minPlayers, maxPlayers, bestMinPlayers, bestMaxPlayers, complexity, genres, memo });
            currentTitles.add(title);
            addedCount++;
          }

          if (addedCount > 0) {
            await batch.commit();
            toast.success(`총 ${addedCount}개의 게임이 라이브러리에 추가되었습니다.`);
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
    try {
      if (editingId) {
        await updateDoc(doc(db, 'games', editingId), formData);
        toast.success('게임 정보가 수정되었습니다.');
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'games'), formData);
        toast.success('신규 게임이 등록되었습니다.');
      }
      setIsAdding(false);
      setFormData({ title: '', minPlayers: 2, maxPlayers: 4, bestMinPlayers: 2, bestMaxPlayers: 4, complexity: 1.0, memo: '', genres: [] });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `games/${editingId || ''}`);
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'games', itemToDelete.id));
      toast.success('게임이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `games/${itemToDelete.id}`);
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const chunkSize = 500;
      for (let i = 0; i < games.length; i += chunkSize) {
        const chunk = games.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(game => {
          batch.delete(doc(db, 'games', game.id));
        });
        await batch.commit();
      }
      toast.success('모든 게임이 삭제되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'games (batch)');
      toast.error('전체 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleteAllModalOpen(false);
    }
  };

  return {
    games,
    filteredGames,
    isAdding, setIsAdding,
    editingId, setEditingId,
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
    handleDeleteAll
  };
}
