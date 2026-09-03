import React from 'react';
import { Search, Filter } from 'lucide-react';
import { GAME_GENRES } from '../domain/games/gameCatalog';

interface GameFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  genreFilter: string;
  setGenreFilter: (genre: string) => void;
  difficultyFilter: string;
  setDifficultyFilter: (diff: string) => void;
  playerCountType: 'best' | 'possible';
  setPlayerCountType: (type: 'best' | 'possible') => void;
  playerCount: string;
  setPlayerCount: (count: string) => void;
  sortOrder: '이름순' | '인기순';
  setSortOrder: (order: '이름순' | '인기순') => void;
}

export default function GameFilters({
  searchTerm,
  setSearchTerm,
  genreFilter,
  setGenreFilter,
  difficultyFilter,
  setDifficultyFilter,
  playerCountType,
  setPlayerCountType,
  playerCount,
  setPlayerCount,
  sortOrder,
  setSortOrder
}: GameFiltersProps) {
  return (
    <div className="glass-panel p-4 flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text"
          placeholder="게임 제목 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/20"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-400" />
        <select 
          value={genreFilter}  
          onChange={e => setGenreFilter(e.target.value)}
          className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
        >
          {['전체', ...GAME_GENRES].map(g => <option key={g} value={g}>{g === '전체' ? '장르 전체' : g}</option>)}
        </select>
        <select 
          value={difficultyFilter}  
          onChange={e => setDifficultyFilter(e.target.value)}
          className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
        >
          {['전체', '1점대', '2점대', '3점대', '4점대 이상', '미평가'].map(d => <option key={d} value={d}>{d === '전체' ? '난이도 전체' : d}</option>)}
        </select>
        <div className="flex gap-2 items-center">
          <select 
            value={playerCountType} 
            onChange={e => setPlayerCountType(e.target.value as 'best' | 'possible')}
            className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
          >
            <option value="best">적정 인원</option>
            <option value="possible">가능 인원</option>
          </select>
          <input 
            type="number"
            min="1"
            placeholder="인원수"
            value={playerCount}
            onChange={e => setPlayerCount(e.target.value)}
            className="w-20 px-3 py-2 bg-white rounded-lg border border-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-slate-300"
          />
        </div>
        <select 
          value={sortOrder} 
          onChange={e => setSortOrder(e.target.value as '이름순' | '인기순')}
          className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
        >
          <option value="이름순">가나다순</option>
          <option value="인기순">인기순 (플레이 횟수)</option>
        </select>
      </div>
    </div>
  );
}
