import React from 'react';
import { Search, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { AVAILABLE_GENRES } from '../hooks/useMembersLogic';

export interface MemberFiltersProps {
  currentTab: '활동' | '휴면';
  setCurrentTab: (tab: '활동' | '휴면') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  genderFilter: string;
  setGenderFilter: (gender: string) => void;
  semesterFilter: string;
  setSemesterFilter: (semester: string) => void;
  semesters: string[];
  genreFilter: string;
  setGenreFilter: (genre: string) => void;
}

export default function MemberFilters({
  currentTab,
  setCurrentTab,
  searchTerm,
  setSearchTerm,
  genderFilter,
  setGenderFilter,
  semesterFilter,
  setSemesterFilter,
  semesters,
  genreFilter,
  setGenreFilter
}: MemberFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 명부 탭 */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setCurrentTab('활동')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-colors",
            currentTab === '활동' ? "border-navy text-navy" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          활동 명부
        </button>
        <button
          onClick={() => setCurrentTab('휴면')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-colors",
            currentTab === '휴면' ? "border-navy text-navy" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          휴면 명부
        </button>
      </div>

      <div className="glass-panel p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="이름, 학번, 닉네임 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-slate-400" />
          <select 
            value={genderFilter}  
            onChange={e => setGenderFilter(e.target.value)}
            aria-label="성별 필터"
            className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
          >
            {['전체', '남', '여', '기타'].map(g => <option key={g} value={g}>{g === '전체' ? '성별' : g}</option>)}
          </select>
          <select 
            value={semesterFilter} 
            onChange={e => setSemesterFilter(e.target.value)}
            aria-label="가입 학기 필터"
            className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
          >
            {semesters.map(s => <option key={s} value={s}>{s === '전체' ? '가입 학기' : s}</option>)}
          </select>
          <select 
            value={genreFilter} 
            onChange={e => setGenreFilter(e.target.value)}
            aria-label="선호 장르 필터"
            className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
          >
            {['전체', ...AVAILABLE_GENRES].map(g => <option key={g} value={g}>{g === '전체' ? '선호 장르' : g}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
