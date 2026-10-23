import React, { useId, useState } from 'react';
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
  const dormantSemesterId = useId();

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
      {isAdminModeActive && selectedDocs.size > 0 && (
        <section aria-label="선택 동아리원 일괄 변경" className="relative rounded-xl border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-x-4 lg:gap-y-1 lg:px-4 lg:py-3">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 lg:contents">
            <p className="text-sm font-semibold text-navy lg:col-start-1 lg:row-start-1 lg:text-xs">{selectedDocs.size}명 선택됨</p>
          </div>
          <p id={`${dormantSemesterId}-hint`} className="mt-1 text-xs leading-5 text-slate-600 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:pr-24">
            입력한 학기부터 통계의 활동 인원에서 제외됩니다.
            {currentTab === '활동' && <span className="block lg:inline"> 휴면 명부로는 실행 즉시 이동합니다.</span>}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:col-start-2 lg:row-start-1 lg:mt-0 lg:max-w-full lg:items-center lg:justify-end lg:justify-self-end">
            <div className="w-full space-y-2 sm:w-44 lg:flex lg:w-auto lg:items-center lg:gap-2 lg:space-y-0">
              <label htmlFor={dormantSemesterId} className="block text-sm font-semibold text-slate-700 lg:text-xs">휴면 시작 학기</label>
              <input
                id={dormantSemesterId}
                type="text"
                value={bulkDormantSemester}
                onChange={(e) => setBulkDormantSemester(e.target.value)}
                placeholder={`예: ${defaultDormantSemester}`}
                aria-describedby={`${dormantSemesterId}-hint`}
                disabled={bulkPending}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50 lg:min-h-9 lg:w-32 lg:py-2 lg:text-xs"
              />
            </div>
            {currentTab === '활동' ? (
              <button
                type="button"
                disabled={bulkPending}
                onClick={() => handleBulkDormant(bulkDormantSemester)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50 lg:min-h-9 lg:py-2 lg:text-xs"
              >
                {bulkPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                {bulkPending ? '전환 중…' : '선택 인원 휴면 전환'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={bulkPending}
                  onClick={() => handleBulkDormantSemesterChange(bulkDormantSemester)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50 lg:min-h-9 lg:py-2 lg:text-xs"
                >
                  {bulkPending && <Loader2 size={14} className="animate-spin" />}
                  {bulkPending ? '변경 중…' : '휴면 시작 학기 변경'}
                </button>
                <button
                  type="button"
                  disabled={bulkPending}
                  onClick={() => handleBulkRestoreActive()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50 lg:min-h-9 lg:py-2 lg:text-xs"
                >
                  {bulkPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  {bulkPending ? '복원 중…' : '활동으로 복원'}
                </button>
              </>
            )}
          </div>
          <button type="button" disabled={bulkPending} onClick={() => setSelectedDocs(new Set())} className="absolute right-4 top-4 min-h-11 sm:right-5 sm:top-5 lg:static rounded-xl px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50 lg:col-start-2 lg:row-start-2 lg:min-h-7 lg:justify-self-end lg:px-2 lg:py-1">선택 해제</button>
        </section>
      )}
      <div className="overflow-x-auto min-w-full">
        <div className="min-w-full md:min-w-[600px]">
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
