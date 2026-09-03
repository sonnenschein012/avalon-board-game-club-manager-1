import React from 'react';
import type { ArchiveChartId, ArchiveFormulaId } from '../hooks/useArchiveLogic';
import { TrendingUp, Users, Activity, Crown, Info } from 'lucide-react';
import { AttendanceTrendChart, NewcomerTrendChart, StagnationChart } from './ArchiveCharts';
import { cn } from '../lib/utils';
import { Game } from '../types';

interface ArchiveWidgetChartsProps {
  selectedSemester: string;
  attendanceTrendMetric: 'count' | 'rate';
  setAttendanceTrendMetric: (m: 'count' | 'rate') => void;
  attendanceTrend: Record<string, unknown>[];
  setExpandedChart: (c: ArchiveChartId | null) => void;
  normalizeNewcomerTrend: boolean;
  setNormalizeNewcomerTrend: (b: boolean) => void;
  newcomerTrend: Record<string, unknown>[];
  setFormulaModal: (m: ArchiveFormulaId | null) => void;
  stagnationTrend: Record<string, unknown>[];
  gameMmi: {gameId: string, mmi: number, game?: Game | undefined}[];
}

export default function ArchiveWidgetCharts({
  selectedSemester,
  attendanceTrendMetric,
  setAttendanceTrendMetric,
  attendanceTrend,
  setExpandedChart,
  normalizeNewcomerTrend,
  setNormalizeNewcomerTrend,
  newcomerTrend,
  setFormulaModal,
  stagnationTrend,
  gameMmi
}: ArchiveWidgetChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 시계열 참석 트렌드 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 min-w-max">
            <TrendingUp className="text-emerald-500" size={20} />
            {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 시계열 참석 트렌드
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setAttendanceTrendMetric('count')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-colors", attendanceTrendMetric === 'count' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              인원 (명)
            </button>
            <button 
              onClick={() => setAttendanceTrendMetric('rate')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-colors", attendanceTrendMetric === 'rate' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              참석률 (%)
            </button>
          </div>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('attendance')}
          title="더블클릭하여 확대"
        >
          {attendanceTrend.length > 0 ? (
            <AttendanceTrendChart data={attendanceTrend} metric={attendanceTrendMetric} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* 신입 유입 및 정착 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 min-w-max">
            <Users className="text-indigo-500" size={20} />
            {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 신입 유입 및 정착 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('newcomers')}
            />
          </h3>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={normalizeNewcomerTrend}
              onChange={e => setNormalizeNewcomerTrend(e.target.checked)}
              className="rounded border-slate-300 text-navy focus:ring-navy cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-500">전체 명부 기준 보정</span>
          </label>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('newcomers')}
          title="더블클릭하여 확대"
        >
          {newcomerTrend.length > 0 ? (
            <NewcomerTrendChart data={newcomerTrend} normalize={normalizeNewcomerTrend} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* 모임 고착화 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2">
            <Activity className="text-rose-500" size={20} />
            {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 모임 고착화 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('stagnation')}
            />
          </h3>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('stagnation')}
          title="더블클릭하여 확대"
        >
          {stagnationTrend.length > 0 ? (
            <StagnationChart data={stagnationTrend} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* 경험 독점 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2">
            <Crown className="text-purple-500" size={20} />
            {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 경험 독점 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('gameMmi')}
            />
          </h3>
        </div>
        <div className="space-y-2 h-[256px] overflow-y-auto pr-2 custom-scrollbar">
          {gameMmi.map((item, idx) => (
            <div key={item.gameId} className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-xl hover:border-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <span className={cn("w-6 text-center font-bold text-lg", idx === 0 ? "text-purple-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-purple-300" : "text-slate-300 text-sm")}>
                  {idx + 1}
                </span>
                <div>
                  <div className="font-bold text-sm text-slate-700">{item.game?.title}</div>
                </div>
              </div>
              <div className="font-bold text-navy bg-slate-50 px-3 py-1.5 rounded-lg text-sm border border-slate-100">
                {item.mmi} 점
              </div>
            </div>
          ))}
          {gameMmi.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">조건을 충족하는 데이터가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
