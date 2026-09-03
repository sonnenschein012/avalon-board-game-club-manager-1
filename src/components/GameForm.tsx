import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_GENRES } from '../domain/games/gameCatalog';
import type { GameFormData } from '../domain/games/gameForm';
import { Loader2 } from 'lucide-react';

interface GameFormProps {
  formData: GameFormData;
  setFormData: React.Dispatch<React.SetStateAction<GameFormData>>;
  handleSubmit: (e: React.FormEvent) => void;
  isAdding: boolean;
  setIsAdding: (val: boolean) => void;
  editingId: string | null;
  saving?: boolean;
}

export default function GameForm({
  formData,
  setFormData,
  handleSubmit,
  isAdding,
  setIsAdding,
  editingId,
  saving = false,
}: GameFormProps) {
  return (
    <AnimatePresence>
      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="glass-panel p-6 border-transparent bg-slate-50/30"
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">게임 제목</label>
              <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="input-field w-full" placeholder="e.g. 테라포밍 마스" />
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block flex justify-between">가능 인원 <span className="text-slate-300 font-normal normal-case">(최소-최대)</span></label>
              <div className="flex items-center gap-1">
                <input type="number" value={formData.minPlayers} onChange={e => setFormData({ ...formData, minPlayers: parseInt(e.target.value) })} className="input-field w-full px-2" />
                <span className="text-slate-300">-</span>
                <input type="number" value={formData.maxPlayers} onChange={e => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) })} className="input-field w-full px-2" />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block flex justify-between">적정 인원 <span className="text-slate-300 font-normal normal-case">(최소-최대)</span></label>
              <div className="flex items-center gap-1">
                <input type="number" value={formData.bestMinPlayers} onChange={e => setFormData({ ...formData, bestMinPlayers: parseInt(e.target.value) })} className="input-field w-full px-2" />
                <span className="text-slate-300">-</span>
                <input type="number" value={formData.bestMaxPlayers} onChange={e => setFormData({ ...formData, bestMaxPlayers: parseInt(e.target.value) })} className="input-field w-full px-2" />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">난이도 (1-5)</label>
              <input type="number" step="0.1" min="1" max="5" value={formData.complexity} onChange={e => setFormData({ ...formData, complexity: parseFloat(e.target.value) })} className="input-field w-full" />
            </div>
            <div className="md:col-span-1 flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">비고 (선택)</label>
              <input value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} className="input-field w-full" placeholder="기타 정보" />
            </div>
            <div className="md:col-span-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">장르 (다중 선택)</label>
              <div className="flex flex-wrap gap-2">
                {GAME_GENRES.map(genre => {
                  const isSelected = formData.genres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          genres: prev.genres.includes(genre)
                            ? prev.genres.filter(g => g !== genre)
                            : [...prev.genres, genre]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                        isSelected 
                          ? 'bg-navy text-white border-gold shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-100 hover:border-gold'
                      }`}
                    >
                      {genre}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 md:col-span-6">
              <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-navy hover:bg-gold text-white rounded-lg text-xs font-bold uppercase shadow-lg disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? (editingId ? '수정 중…' : '등록 중…') : editingId ? '수정 완료' : '등록 완료'}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">취소</button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
