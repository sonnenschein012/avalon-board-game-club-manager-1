import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Search, Edit2, Trash2, Info, Loader2, UserCheck, UserMinus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Member } from '../types';
import MemberForm from './MemberForm';
import { defaultDormantSemester, type MemberFormData } from '../domain/members/memberForm';

interface MemberListProps {
  filteredMembers: Member[];
  editingId: string | null;
  onEdit: (member: Member) => void;
  setViewingMember: (member: Member | null) => void;
  setItemToDelete: (val: { id: string, name: string }) => void;
  setFormData: React.Dispatch<React.SetStateAction<MemberFormData>>;
  setIsAdding: (val: boolean) => void;
  formData: MemberFormData;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
  isAdminModeActive: boolean;
  selectedDocs: Set<string>;
  setSelectedDocs: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkDormant: (semester: string) => Promise<void>;
  handleBulkDormantSemesterChange: (semester: string) => Promise<void>;
  handleBulkRestoreActive: () => Promise<void>;
  currentTab: '활동' | '휴면';
  saving?: boolean;
  bulkPending?: boolean;
}

export default function MemberList({
  filteredMembers,
  editingId,
  onEdit,
  setViewingMember,
  setItemToDelete,
  setFormData,
  setIsAdding,
  formData,
  handleSubmit,
  resetForm,
  isAdminModeActive,
  selectedDocs,
  setSelectedDocs,
  handleBulkDormant,
  handleBulkDormantSemesterChange,
  handleBulkRestoreActive,
  currentTab,
  saving = false,
  bulkPending = false,
}: MemberListProps) {
  const [bulkDormantSemester, setBulkDormantSemester] = useState(defaultDormantSemester);

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredMembers.map(m => m.id));
      setSelectedDocs(allIds);
    } else {
      setSelectedDocs(new Set());
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedDocs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDocs(next);
  };
  return (
    <div className="glass-panel overflow-hidden border border-slate-100 p-0 md:p-0">
      <div className="overflow-x-auto min-w-full">
        <div className="min-w-full md:min-w-[600px]">
          {isAdminModeActive && selectedDocs.size > 0 && (
            <div className="bg-navy p-4 flex items-center justify-between text-white animate-in slide-in-from-top-2">
              <div className="text-sm font-medium">
                {selectedDocs.size}명 선택됨
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={bulkDormantSemester}
                  onChange={(e) => setBulkDormantSemester(e.target.value)}
                  placeholder={currentTab === '활동' ? '휴면 지정 학기' : '변경할 휴면 학기'}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold w-36"
                />
                {currentTab === '활동' ? (
                  <button
                    disabled={bulkPending}
                    onClick={() => handleBulkDormant(bulkDormantSemester)}
                    className="flex items-center gap-1.5 bg-gold hover:brightness-110 text-navy px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    {bulkPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                    {bulkPending ? '전환 중…' : '선택 인원 휴면 전환'}
                  </button>
                ) : (
                  <>
                    <button
                      disabled={bulkPending}
                      onClick={() => handleBulkDormantSemesterChange(bulkDormantSemester)}
                      className="flex items-center gap-1.5 bg-gold hover:brightness-110 text-navy px-3 py-1.5 rounded-lg text-xs font-bold transition"
                    >
                      {bulkPending ? '변경 중…' : '휴면 학기 변경'}
                    </button>
                    <button
                      disabled={bulkPending}
                      onClick={() => handleBulkRestoreActive()}
                      className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    >
                      {bulkPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      {bulkPending ? '복원 중…' : '활동으로 복원'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="hidden md:flex bg-slate-50 items-center">
            {isAdminModeActive && (
              <div className="table-header w-12 flex justify-center border-r border-slate-100">
                <input
                  type="checkbox"
                  className="rounded text-navy focus:ring-navy"
                  onChange={toggleAll}
                  checked={filteredMembers.length > 0 && selectedDocs.size === filteredMembers.length}
                />
              </div>
            )}
            <div className="table-header w-12">#</div>
            <div className="table-header flex-1">기본 정보 (이름/학번)</div>
            <div className="table-header w-32">성별/학기</div>
            <div className="table-header w-40 text-right">작업</div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredMembers.map((member, idx) => (
              <React.Fragment key={member.id}>
                {/* Desktop View (md:flex) */}
                <div className="hidden md:flex items-center hover:bg-slate-50/80 transition-all group">
                  {isAdminModeActive && (
                    <div className="table-cell w-12 flex justify-center border-r border-slate-100 mr-3">
                      <input
                        type="checkbox"
                        className="rounded text-navy focus:ring-navy"
                        checked={selectedDocs.has(member.id)}
                        onChange={() => toggleOne(member.id)}
                      />
                    </div>
                  )}
                  <div className="table-cell w-12 text-[10px] font-bold text-slate-400">{idx + 1}</div>
                  <div className="table-cell flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-navy font-bold text-xs uppercase shrink-0">
                        {member.name?.[0] || '?'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1">
                          {member.name} 
                          {member.isBoardMember && <span title="임원" className="text-xs text-gold">👑</span>}
                          {member.status === '휴면' && <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded font-bold ml-1">휴면 ({member.dormantSemester})</span>}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono italic">{member.nickname ? `@${member.nickname} • ` : ''}{member.studentId}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="table-cell w-32 shrink-0">
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded inline-block",
                      member.gender === '남' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                    )}>{member.gender}</span>
                    <span className="ml-2 text-[10px] text-slate-400 font-mono">{member.semester}</span>
                  </div>
                  
                  <div className="table-cell w-40 text-right flex items-center justify-end gap-1 shrink-0">
                    <button 
                      onClick={() => setViewingMember(member)}
                      className="p-1.5 text-slate-400 hover:text-navy transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                      title="상세 기록"
                    >
                      <Info size={16} />
                    </button>
                    <button 
                      onClick={() => onEdit(member)}
                      className="p-1.5 text-slate-400 hover:text-gold transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setItemToDelete({ id: member.id, name: member.name })}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Mobile View (md:hidden) */}
                <div className="md:hidden flex flex-col hover:bg-slate-50/80 transition-all group p-4">
                  <div className="flex items-center mb-3">
                    {isAdminModeActive && (
                      <div className="flex justify-center mr-3">
                        <input
                          type="checkbox"
                          className="rounded text-navy focus:ring-navy"
                          checked={selectedDocs.has(member.id)}
                          onChange={() => toggleOne(member.id)}
                        />
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 w-6">#{idx + 1}</span>
                    <div className="flex-1 flex justify-end gap-2">
                       <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded inline-block",
                        member.gender === '남' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                      )}>{member.gender}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{member.semester}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-navy font-bold text-xs uppercase shrink-0">
                      {member.name?.[0] || '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-1">
                        {member.name} 
                        {member.isBoardMember && <span title="임원" className="text-xs text-gold">👑</span>}
                        {member.status === '휴면' && <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded font-bold ml-1">휴면 ({member.dormantSemester})</span>}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono italic">{member.nickname ? `@${member.nickname} • ` : ''}{member.studentId}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => setViewingMember(member)}
                      className="p-1.5 text-slate-400 hover:text-navy transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                      title="상세 기록"
                    >
                      <Info size={16} />
                    </button>
                    <button 
                      onClick={() => onEdit(member)}
                      className="p-1.5 text-slate-400 hover:text-gold transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setItemToDelete({ id: member.id, name: member.name })}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-white rounded border border-transparent hover:border-slate-100 shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {editingId === member.id && (
                    <div className="px-4 pb-4 bg-slate-50/50 border-t border-slate-100">
                      <div className="mt-4">
                        <MemberForm
                          formData={formData}
                          setFormData={setFormData}
                          handleSubmit={handleSubmit}
                          setIsAdding={setIsAdding}
                          resetForm={resetForm}
                          editingId={editingId}
                          saving={saving}
                        />
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
            {filteredMembers.length === 0 && (
              <div className="p-20 text-center text-slate-300">
                <Search size={40} className="mx-auto mb-4 opacity-10" />
                <p className="text-sm font-bold">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
