import React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { Member } from '../types';

interface ArchiveWidgetRankingProps {
  selectedSemester: string;
  filteredSessionsLength: number;
  includeBoardMembers: boolean;
  setIncludeBoardMembers: (b: boolean) => void;
  attendanceMetric: 'count' | 'rate';
  setAttendanceMetric: (m: 'count' | 'rate') => void;
  w1Ranking: {id: string, count: number, member?: Member}[];
}

export default function ArchiveWidgetRanking({
  selectedSemester,
  filteredSessionsLength,
  includeBoardMembers,
  setIncludeBoardMembers,
  attendanceMetric,
  setAttendanceMetric,
  w1Ranking
}: ArchiveWidgetRankingProps) {
  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-navy flex items-center gap-2">
          <Trophy className="text-gold" size={20} />
          {selectedSemester === '전체' ? '전체 누적 출석 랭킹' : `${selectedSemester} 출석 랭킹`}
          <span className="text-xs font-normal text-slate-400 ml-2">(총 {filteredSessionsLength}회 모임 기준)</span>
        </h3>
        <div className="flex flex-wrap items-center gap-4 mt-2 md:mt-0">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={includeBoardMembers}
              onChange={e => setIncludeBoardMembers(e.target.checked)}
              className="rounded border-slate-300 text-navy focus:ring-navy cursor-pointer"
            />
            <span className="text-[10px] md:text-xs font-bold text-slate-500">임원진 포함</span>
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setAttendanceMetric('count')}
              className={cn("px-2 py-1 md:px-3 md:py-1 rounded text-[10px] md:text-xs font-bold transition-colors", attendanceMetric === 'count' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              횟수(회)
            </button>
            <button 
              onClick={() => setAttendanceMetric('rate')}
              className={cn("px-2 py-1 md:px-3 md:py-1 rounded text-[10px] md:text-xs font-bold transition-colors", attendanceMetric === 'rate' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              비율(%)
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {w1Ranking.map((item, idx) => (
          <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-xl hover:border-slate-100 transition-colors">
            <div className="flex items-center gap-4">
              <span className={cn("w-6 text-center font-bold text-lg", idx === 0 ? "text-gold" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-400" : "text-slate-300 text-sm")}>
                {idx + 1}
              </span>
              <div>
                <div className="font-bold text-sm text-slate-700">
                  {item.member?.name}
                  {item.member?.isBoardMember && <span title="임원" className="text-sm ml-1">👑</span>}
                </div>
                <div className="text-[10px] text-slate-400">{item.member?.nickname || '-'}</div>
              </div>
            </div>
            <div className="font-bold text-navy bg-slate-50 px-3 py-1.5 rounded-lg text-sm border border-slate-100">
              {attendanceMetric === 'count' 
                ? `${item.count}회` 
                : `${filteredSessionsLength > 0 ? Math.round((item.count / filteredSessionsLength) * 1000)/10 : 0}%`}
            </div>
          </div>
        ))}
        {w1Ranking.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">표시할 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}
