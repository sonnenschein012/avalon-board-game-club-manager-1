import React from 'react';
import { TrendingUp, Users, Activity, X } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ArchiveExpandedChartModalProps {
  expandedChart: 'w4' | 'w5' | 'w6' | null;
  setExpandedChart: (c: 'w4' | 'w5' | 'w6' | null) => void;
  w4Metric: 'count' | 'rate';
  setW4Metric: (m: 'count' | 'rate') => void;
  w4Data: Record<string, unknown>[];
  w5Normalize: boolean;
  setW5Normalize: (b: boolean) => void;
  w5Data: Record<string, unknown>[];
  w6Data: Record<string, unknown>[];
}

export default function ArchiveExpandedChartModal({
  expandedChart,
  setExpandedChart,
  w4Metric,
  setW4Metric,
  w4Data,
  w5Normalize,
  setW5Normalize,
  w5Data,
  w6Data
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
                {expandedChart === 'w4' && <><TrendingUp className="text-emerald-500" size={20} /> 시계열 참석 트렌드</>}
                {expandedChart === 'w5' && <><Users className="text-indigo-500" size={20} /> 신입 유입 및 정착 지수</>}
                {expandedChart === 'w6' && <><Activity className="text-rose-500" size={20} /> 모임 고착화 지수</>}
              </h3>
              <div className="flex items-center gap-4">
                {expandedChart === 'w4' && (
                  <div className="flex bg-slate-200 p-1 rounded-lg shrink-0">
                    <button 
                      onClick={() => setW4Metric('count')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors", w4Metric === 'count' ? "bg-white text-navy shadow-sm" : "text-slate-500")}
                    >
                      인원 (명)
                    </button>
                    <button 
                      onClick={() => setW4Metric('rate')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors", w4Metric === 'rate' ? "bg-white text-navy shadow-sm" : "text-slate-500")}
                    >
                      참석률 (%)
                    </button>
                  </div>
                )}
                {expandedChart === 'w5' && (
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={w5Normalize}
                      onChange={e => setW5Normalize(e.target.checked)}
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
                <ResponsiveContainer width="100%" height="100%">
                  {expandedChart === 'w4' ? (
                    <RechartsLineChart data={w4Data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateStr" tick={{fontSize: 12}} tickMargin={12} stroke="#64748b" />
                      <YAxis tick={{fontSize: 12}} stroke="#64748b" />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                      <Line type="monotone" dataKey={w4Metric} stroke="#10b981" strokeWidth={4} dot={{ r: 6 }} activeDot={{ r: 8 }} name={w4Metric === 'count' ? '인원 (명)' : '참석률 (%)'} />
                    </RechartsLineChart>
                  ) : expandedChart === 'w5' ? (
                    w5Normalize ? (
                      <RechartsLineChart data={w5Data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="dateStr" tick={{fontSize: 12}} tickMargin={12} stroke="#64748b" />
                        <YAxis tick={{fontSize: 12}} stroke="#64748b" />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                        <Line type="monotone" dataKey="보정지수" stroke="#6366f1" strokeWidth={4} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                      </RechartsLineChart>
                    ) : (
                      <RechartsBarChart data={w5Data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="dateStr" tick={{fontSize: 12}} tickMargin={12} stroke="#64748b" />
                        <YAxis tick={{fontSize: 12}} stroke="#64748b" />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '20px' }} />
                        <Bar dataKey="신입" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                        <Bar dataKey="기존" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    )
                  ) : expandedChart === 'w6' ? (
                    <RechartsLineChart data={w6Data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateStr" tick={{fontSize: 12}} tickMargin={12} stroke="#64748b" />
                      <YAxis tick={{fontSize: 12}} stroke="#64748b" />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                      <Line type="monotone" dataKey="정체성지수" stroke="#f43f5e" strokeWidth={4} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                    </RechartsLineChart>
                  ) : null}
                </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
