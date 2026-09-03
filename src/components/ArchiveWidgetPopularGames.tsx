import React from 'react';
import { LineChart } from 'lucide-react';
import { cn } from '../lib/utils';
import FilterPills from './FilterPills';
import { Game } from '../types';

interface ArchiveWidgetPopularGamesProps {
  selectedSemester: string;
  popularGameGenres: string[];
  setPopularGameGenres: (g: string[]) => void;
  popularGameDifficulties: string[];
  setPopularGameDifficulties: (d: string[]) => void;
  popularGames: {gameId: string, count: number, uniqueCount: number, fixation: number, game?: Game | undefined}[];
  availableGenres: string[];
  difficultyRanges: {label: string}[];
}

export default function ArchiveWidgetPopularGames({
  selectedSemester,
  popularGameGenres,
  setPopularGameGenres,
  popularGameDifficulties,
  setPopularGameDifficulties,
  popularGames,
  availableGenres,
  difficultyRanges
}: ArchiveWidgetPopularGamesProps) {
  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-navy flex items-center gap-2">
          <LineChart className="text-orange-500" size={20} />
          {selectedSemester === '전체' ? '전체' : selectedSemester} 인기 게임 분석
        </h3>
      </div>
      <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div>
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">선호 장르 필터</p>
           <FilterPills options={availableGenres} selected={popularGameGenres} onChange={setPopularGameGenres} />
        </div>
        <div>
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">난이도 필터</p>
           <FilterPills options={difficultyRanges.map(r => r.label)} selected={popularGameDifficulties} onChange={setPopularGameDifficulties} />
        </div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {popularGames.map((item, idx) => (
          <div key={item.gameId} className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-xl hover:border-slate-100 transition-colors">
            <div className="flex items-center gap-4">
              <span className={cn("w-6 text-center font-bold text-lg", idx === 0 ? "text-orange-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-400" : "text-slate-300 text-sm")}>
                {idx + 1}
              </span>
              <div>
                <div className="font-bold text-sm text-slate-700">{item.game?.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">경험자: {item.uniqueCount}명</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-navy bg-slate-50 px-3 py-1 rounded-lg text-sm mb-1 inline-block border border-slate-100">
                {item.count}회 플레이
              </div>
              <div className="text-[10px] font-bold text-crimson">
                선택 기간 참가자 대비: {item.fixation}%
              </div>
            </div>
          </div>
        ))}
        {popularGames.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">표시할 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}
