import React from 'react';
import { Hash, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import FilterPills from './FilterPills';
import { Member, Game } from '../types';

interface ArchiveWidgetCorePlayersProps {
  selectedSemester: string;
  w3IncludeBoardMembers: boolean;
  setW3IncludeBoardMembers: (b: boolean) => void;
  w3Genres: string[];
  setW3Genres: (g: string[]) => void;
  w3Difficulties: string[];
  setW3Difficulties: (d: string[]) => void;
  w3TargetGames: string[];
  setW3TargetGames: (g: string[]) => void;
  w3GameSearchQuery: string;
  setW3GameSearchQuery: (q: string) => void;
  games: Game[];
  w3CorePlayers: {id: string, hits: number, member?: Member}[];
  AVAILABLE_GENRES: string[];
  DIFFICULTY_RANGES: {label: string}[];
}

export default function ArchiveWidgetCorePlayers({
  selectedSemester,
  w3IncludeBoardMembers,
  setW3IncludeBoardMembers,
  w3Genres,
  setW3Genres,
  w3Difficulties,
  setW3Difficulties,
  w3TargetGames,
  setW3TargetGames,
  w3GameSearchQuery,
  setW3GameSearchQuery,
  games,
  w3CorePlayers,
  AVAILABLE_GENRES,
  DIFFICULTY_RANGES
}: ArchiveWidgetCorePlayersProps) {
  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-navy flex items-center gap-2">
          <Hash className="text-blue-500" size={20} />
          {selectedSemester === '전체' ? '전체' : selectedSemester} 코어 플레이어 분석
        </h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={w3IncludeBoardMembers}
              onChange={e => setW3IncludeBoardMembers(e.target.checked)}
              className="rounded border-slate-300 text-navy focus:ring-navy cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-500">임원진 통계 포함</span>
          </label>
        </div>
      </div>
      <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div>
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">대상 장르 필터</p>
           <FilterPills options={AVAILABLE_GENRES} selected={w3Genres} onChange={setW3Genres} />
        </div>
        <div>
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">대상 난이도 필터</p>
           <FilterPills options={DIFFICULTY_RANGES.map(r => r.label)} selected={w3Difficulties} onChange={setW3Difficulties} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">대상 게임</p>
          <div className="space-y-2 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="게임 검색..."
                value={w3GameSearchQuery}
                onChange={e => setW3GameSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            {w3GameSearchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-10">
                {games
                   .filter(g => g.title.toLowerCase().includes(w3GameSearchQuery.toLowerCase()))
                   .map(g => (
                     <button
                       key={g.id}
                       onClick={() => {
                         if (!w3TargetGames.includes(g.id)) {
                           setW3TargetGames([...w3TargetGames, g.id]);
                         }
                         setW3GameSearchQuery('');
                       }}
                       className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded-md transition-colors"
                     >
                       {g.title}
                     </button>
                   ))}
                {games.filter(g => g.title.toLowerCase().includes(w3GameSearchQuery.toLowerCase())).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">검색 결과가 없습니다.</p>
                )}
              </div>
            )}
            
            {w3TargetGames.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {w3TargetGames.map(id => {
                  const game = games.find(g => g.id === id);
                  if (!game) return null;
                  return (
                    <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 shadow-sm text-sm font-bold">
                      {game.title}
                      <button 
                        onClick={() => setW3TargetGames(w3TargetGames.filter(gId => gId !== id))}
                        className="hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-blue-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {w3CorePlayers.map((item, idx) => (
          <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-xl hover:border-slate-100 transition-colors">
            <div className="flex items-center gap-4">
              <span className={cn("w-6 text-center font-bold text-lg", idx === 0 ? "text-blue-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-blue-300" : "text-slate-300 text-sm")}>
                {idx + 1}
              </span>
              <div>
                <div className="font-bold text-sm text-slate-700">
                  {item.member?.name}
                  {item.member?.isBoardMember && <span title="임원" className="text-sm ml-1">👑</span>}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{item.member?.nickname || '-'}</div>
              </div>
            </div>
            <div className="font-bold text-navy bg-slate-50 px-3 py-1.5 rounded-lg text-sm border border-slate-100">
              {item.hits}회 플레이
            </div>
          </div>
        ))}
        {w3CorePlayers.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">표시할 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}
