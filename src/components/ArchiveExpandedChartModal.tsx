import React from 'react';
import type { ArchiveChartId } from '../hooks/useArchiveLogic';
import { TrendingUp, Users, Activity, X } from 'lucide-react';
import { AttendanceTrendChart, NewcomerTrendChart, StagnationChart } from './ArchiveCharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ArchiveExpandedChartModalProps {
  selectedSemester: string;
  expandedChart: ArchiveChartId | null;
  setExpandedChart: (c: ArchiveChartId | null) => void;
  attendanceTrendMetric: 'count' | 'rate';
  setAttendanceTrendMetric: (m: 'count' | 'rate') => void;
  attendanceTrend: Record<string, unknown>[];
  normalizeNewcomerTrend: boolean;
  setNormalizeNewcomerTrend: (b: boolean) => void;
  newcomerTrend: Record<string, unknown>[];
  stagnationTrend: Record<string, unknown>[];
}

export default function ArchiveExpandedChartModal({
  selectedSemester,
  expandedChart,
  setExpandedChart,
  attendanceTrendMetric,
  setAttendanceTrendMetric,
  attendanceTrend,
  normalizeNewcomerTrend,
  setNormalizeNewcomerTrend,
  newcomerTrend,
  stagnationTrend
}: ArchiveExpandedChartModalProps) {
  return (
    <AnimatePresence>
      {expandedChart && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setExpandedChart(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-navy flex items-center gap-2">
                {expandedChart === 'attendance' && <><TrendingUp className="text-emerald-500" size={20} /> {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 시계열 참석 트렌드</>}
                {expandedChart === 'newcomers' && <><Users className="text-indigo-500" size={20} /> {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 신입 유입 및 정착 지수</>}
                {expandedChart === 'stagnation' && <><Activity className="text-rose-500" size={20} /> {selectedSemester === '전체' ? '전체 학기' : selectedSemester} 모임 고착화 지수</>}
              </h3>
              <div className="flex items-center gap-4">
                {expandedChart === 'attendance' && (
                  <div className="flex bg-slate-200 p-1 rounded-lg shrink-0">
                    <button 
                      onClick={() => setAttendanceTrendMetric('count')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors", attendanceTrendMetric === 'count' ? "bg-white text-navy shadow-sm" : "text-slate-500")}
                    >
                      인원 (명)
                    </button>
                    <button 
                      onClick={() => setAttendanceTrendMetric('rate')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors", attendanceTrendMetric === 'rate' ? "bg-white text-navy shadow-sm" : "text-slate-500")}
                    >
                      참석률 (%)
                    </button>
                  </div>
                )}
                {expandedChart === 'newcomers' && (
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={normalizeNewcomerTrend}
                      onChange={e => setNormalizeNewcomerTrend(e.target.checked)}
                      className="rounded border-slate-300 text-navy focus:ring-navy cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-600">전체 명부 기준 보정</span>
                  </label>
                )}
                <button 
                  onClick={() => setExpandedChart(null)} 
                  className="p-2 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors border border-slate-200 shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 bg-white min-h-0">
              {expandedChart === 'attendance' && (
                <AttendanceTrendChart data={attendanceTrend} metric={attendanceTrendMetric} expanded />
              )}
              {expandedChart === 'newcomers' && (
                <NewcomerTrendChart data={newcomerTrend} normalize={normalizeNewcomerTrend} expanded />
              )}
              {expandedChart === 'stagnation' && (
                <StagnationChart data={stagnationTrend} expanded />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
