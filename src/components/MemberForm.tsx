import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { AVAILABLE_GENRES, defaultSemester, defaultDormantSemester, MemberFormData } from '../hooks/useMembersLogic';

export interface MemberFormProps {
  formData: MemberFormData;
  setFormData: (data: MemberFormData | ((prev: MemberFormData) => MemberFormData)) => void;
  handleSubmit: (e: React.FormEvent) => void;
  setIsAdding: (val: boolean) => void;
  resetForm: () => void;
  editingId: string | null;
  saving?: boolean;
}

export default function MemberForm({
  formData,
  setFormData,
  handleSubmit,
  setIsAdding,
  resetForm,
  editingId,
  saving = false,
}: MemberFormProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-panel p-6 border-transparent bg-slate-50/30"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">이름</label>
            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="홍길동" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">닉네임</label>
            <input value={formData.nickname} onChange={e => setFormData({ ...formData, nickname: e.target.value })} className="input-field" placeholder="길동왕" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">학번</label>
            <input required value={formData.studentId} onChange={e => setFormData({ ...formData, studentId: e.target.value })} className="input-field" placeholder={`예: ${new Date().getFullYear().toString().slice(-2)}`} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">연락처</label>
            <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input-field" placeholder="010-0000-0000" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">성별</label>
            <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value as '남' | '여' | '기타' })} className="input-field">
              <option value="남">남</option>
              <option value="여">여</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">가입 학기</label>
            <input value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} className="input-field" placeholder={defaultSemester} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">휴면 학기 (선택)</label>
            <input value={formData.dormantSemester} onChange={e => setFormData({ ...formData, dormantSemester: e.target.value })} className="input-field" placeholder={defaultDormantSemester} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">임원 여부</label>
            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input type="checkbox" checked={formData.isBoardMember} onChange={e => setFormData({ ...formData, isBoardMember: e.target.checked })} className="rounded border-slate-300 text-navy focus:ring-navy" />
              <span className="text-xs font-bold text-slate-600">해당됨</span>
            </label>
          </div>
          <div className="space-y-1 flex-1 md:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">메모/특이사항</label>
            <input value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} className="input-field" placeholder="기타 정보" />
          </div>
          <div className="space-y-1 md:col-span-4 mt-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">선호 장르 (다중 선택)</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_GENRES.map(genre => {
                const isSelected = formData.preferredGenre.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFormData({ ...formData, preferredGenre: formData.preferredGenre.filter(g => g !== genre) });
                      } else {
                        setFormData({ ...formData, preferredGenre: [...formData.preferredGenre, genre] });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                      isSelected 
                        ? 'bg-navy text-white border-gold shadow-sm' 
                        : 'bg-white text-slate-500 border-slate-100 hover:border-gold'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => { setIsAdding(false); resetForm(); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase">취소</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-2 bg-navy hover:bg-gold text-white rounded-lg text-xs font-bold shadow-lg uppercase disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? (editingId ? '수정 중…' : '등록 중…') : editingId ? '정보 수정' : '멤버 등록'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
