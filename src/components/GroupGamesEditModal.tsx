import React, { useState, useEffect } from 'react';
import { X, Save, Search, Plus } from 'lucide-react';
import { Session, StoredSessionGroup, Game } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface GroupGamesEditModalProps {
  session: Session;
  group: StoredSessionGroup;
  games: Game[];
  onClose: () => void;
}

export default function GroupGamesEditModal({ session, group, games, onClose }: GroupGamesEditModalProps) {
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>(group.gameIds || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedGameIds(group.gameIds || []);
  }, [group]);

  const handleToggleGame = (gameId: string) => {
    if (selectedGameIds.includes(gameId)) {
      setSelectedGameIds(selectedGameIds.filter(id => id !== gameId));
    } else {
      setSelectedGameIds([...selectedGameIds, gameId]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'sessions', session.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentData = docSnap.data() as Session;
        const currentGroups = currentData.groups || [];

        const groupIndex = currentGroups.findIndex(g => g.id === group.id);
        const existing = currentGroups[groupIndex];
        if (groupIndex !== -1 && existing) {
          currentGroups[groupIndex] = {
            ...existing,
            gameIds: selectedGameIds
          };

          await updateDoc(docRef, { groups: currentGroups });
          toast.success('조 게임 기록이 성공적으로 수정되었습니다.');
          onClose();
        } else {
          toast.error('해당 조를 찾을 수 없습니다.');
        }
      } else {
        toast.error('세션을 찾을 수 없습니다.');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `sessions/${session.id}`);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredGames = games.filter(g =>
    g.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">조 게임 기록 수정</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">{session.name} - {group.name || '이름 없음'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">선택된 게임</h4>
            <div className="flex flex-wrap gap-2">
              {selectedGameIds.length === 0 ? (
                <p className="text-xs text-slate-400 italic">선택된 게임이 없습니다.</p>
              ) : (
                selectedGameIds.map(gameId => {
                  const game = games.find(g => g.id === gameId);
                  return (
                    <div key={gameId} className="flex items-center gap-1 bg-navy text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                      {game?.title || gameId}
                      <button
                        onClick={() => handleToggleGame(gameId)}
                        className="ml-1 text-white/50 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">게임 목록</h4>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="게임 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 max-h-60 overflow-y-auto pr-2 pb-2">
              {filteredGames.map(game => {
                const isSelected = selectedGameIds.includes(game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => handleToggleGame(game.id)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate pr-2">{game.title}</span>
                      {isSelected ? <X size={12} className="shrink-0 opacity-50" /> : <Plus size={12} className="shrink-0 opacity-30" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-navy hover:bg-gold text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
