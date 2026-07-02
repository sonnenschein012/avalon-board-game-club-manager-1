import React from 'react';
import { LineChart } from 'lucide-react';
import { cn } from '../lib/utils';
import FilterPills from './FilterPills';
import { Game } from '../types';

interface ArchiveWidgetPopularGamesProps {
  selectedSemester: string;
  w2Genres: string[];
  setW2Genres: (g: string[]) => void;
  w2Difficulties: string[];
  setW2Difficulties: (d: string[]) => void;
  w2PopularGames: {gameId: string, count: number, uniqueCount: number, fixation: number, game?: Game}[];
  AVAILABLE_GENRES: string[];
  DIFFICULTY_RANGES: {label: string}[];
}

export default function ArchiveWidgetPopularGames({
  selectedSemester,
  w2Genres,
  setW2Genres,
  w2Difficulties,
  setW2Difficulties,
  w2PopularGames,
  AVAILABLE_GENRES,
  DIFFICULTY_RANGES
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
           <FilterPills options={AVAILABLE_GENRES} selected={w2Genres} onChange={setW2Genres} />
        </div>
        <div>
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">난이도 필터</p>
           <FilterPills options={DIFFICULTY_RANGES.map(r => r.label)} selected={w2Difficulties} onChange={setW2Difficulties} />
        </div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {w2PopularGames.map((item, idx) => (
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
                경험자 비율: {item.fixation}%
              </div>
            </div>
          </div>
        ))}
        {w2PopularGames.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">표시할 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}
