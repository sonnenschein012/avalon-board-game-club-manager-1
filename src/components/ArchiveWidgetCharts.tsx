import React from 'react';
import { TrendingUp, Users, Activity, Crown, Info } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import { cn } from '../lib/utils';
import { Game } from '../types';

interface ArchiveWidgetChartsProps {
  w4Metric: 'count' | 'rate';
  setW4Metric: (m: 'count' | 'rate') => void;
  w4Data: Record<string, unknown>[];
  setExpandedChart: (c: 'w4' | 'w5' | 'w6' | null) => void;
  w5Normalize: boolean;
  setW5Normalize: (b: boolean) => void;
  w5Data: Record<string, unknown>[];
  setFormulaModal: (m: 'w5' | 'w6' | 'w7' | null) => void;
  w6Data: Record<string, unknown>[];
  w7MMI: {gameId: string, mmi: number, game?: Game | undefined}[];
}

export default function ArchiveWidgetCharts({
  w4Metric,
  setW4Metric,
  w4Data,
  setExpandedChart,
  w5Normalize,
  setW5Normalize,
  w5Data,
  setFormulaModal,
  w6Data,
  w7MMI
}: ArchiveWidgetChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Widget 4: 시계열 참석 트렌드 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 min-w-max">
            <TrendingUp className="text-emerald-500" size={20} />
            시계열 참석 트렌드
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setW4Metric('count')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-colors", w4Metric === 'count' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              인원 (명)
            </button>
            <button 
              onClick={() => setW4Metric('rate')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-colors", w4Metric === 'rate' ? "bg-white text-navy shadow-sm" : "text-slate-400")}
            >
              참석률 (%)
            </button>
          </div>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('w4')}
          title="더블클릭하여 확대"
        >
          {w4Data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={w4Data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateStr" tick={{fontSize: 10}} tickMargin={10} stroke="#94a3b8" />
                <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                <Line type="monotone" dataKey={w4Metric} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name={w4Metric === 'count' ? '인원 (명)' : '참석률 (%)'} />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* Widget 5: 신입 유입 및 정착 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 min-w-max">
            <Users className="text-indigo-500" size={20} />
            신입 유입 및 정착 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('w5')} 
            />
          </h3>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={w5Normalize}
              onChange={e => setW5Normalize(e.target.checked)}
              className="rounded border-slate-300 text-navy focus:ring-navy cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-500">전체 명부 기준 보정</span>
          </label>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('w5')}
          title="더블클릭하여 확대"
        >
          {w5Data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {w5Normalize ? (
                <RechartsLineChart data={w5Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateStr" tick={{fontSize: 10}} tickMargin={10} stroke="#94a3b8" />
                  <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                  <Line type="monotone" dataKey="보정지수" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </RechartsLineChart>
              ) : (
                <RechartsBarChart data={w5Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateStr" tick={{fontSize: 10}} tickMargin={10} stroke="#94a3b8" />
                  <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="신입" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="기존" stackId="a" fill="#cbd5e1" />
                </RechartsBarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* Widget 6: 모임 고착화 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2">
            <Activity className="text-rose-500" size={20} />
            모임 고착화 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('w6')} 
            />
          </h3>
        </div>
        
        <div 
          className="w-full h-64 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-300 transition-colors"
          onDoubleClick={() => setExpandedChart('w6')}
          title="더블클릭하여 확대"
        >
          {w6Data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={w6Data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateStr" tick={{fontSize: 10}} tickMargin={10} stroke="#94a3b8" />
                <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
                <Line type="monotone" dataKey="정체성지수" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">데이터가 부족합니다.</div>
          )}
        </div>
      </div>

      {/* Widget 7: 경험 독점 지수 */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2">
            <Crown className="text-purple-500" size={20} />
            경험 독점 지수
            <Info 
              className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
              onClick={() => setFormulaModal('w7')} 
            />
          </h3>
        </div>
        <div className="space-y-2 h-[256px] overflow-y-auto pr-2 custom-scrollbar">
          {w7MMI.map((item, idx) => (
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
          {w7MMI.length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-bold">조건을 충족하는 데이터가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
