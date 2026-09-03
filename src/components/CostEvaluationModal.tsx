import { Activity, X } from 'lucide-react';
import type { SessionGroup, Member } from '../types';
import { getGroupCostDets, type CostCalculationContext } from '../domain/matching/groupCostFunction';

interface CostEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SessionGroup[];
  getMember: (attendeeId: string) => Member | undefined;
  context: CostCalculationContext;
}

export default function CostEvaluationModal({
  isOpen,
  onClose,
  groups,
  getMember,
  context,
}: CostEvaluationModalProps) {
  if (!isOpen) return null;

  const costBreakdowns = groups.map((group, index) => {
    const members = group.memberIds.map(getMember).filter((member): member is Member => Boolean(member));
    const breakdown = getGroupCostDets(members, context);
    return {
      id: group.id,
      name: group.name || 'TEAM ' + (index + 1),
      breakdown,
      total: breakdown.costWithoutReward - breakdown.requestReward,
    };
  });
  const totalCost = costBreakdowns.reduce((sum, group) => sum + group.total, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-navy text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity size={20} className="text-gold" />
            비용 평가지표 분석
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-slate-50">
          <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <span className="font-bold text-slate-700">전체 평가지표 총합</span>
            <span className="text-2xl font-black text-navy">{totalCost.toFixed(2)}</span>
          </div>
          <div className="space-y-4">
            {costBreakdowns.map(item => (
              <div key={item.id} className="bg-white border text-left border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                  <span className="font-bold text-white bg-navy px-3 py-1 rounded-full text-xs shadow-sm tracking-wide">총 비용: {item.total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: '학번 편차', value: item.breakdown.ageVarianceCost },
                    { label: '누적 출석 경험 균형', value: item.breakdown.experienceCost },
                    { label: '현재 학기 활동 균형', value: item.breakdown.activityCost },
                    { label: '성비 편차', value: item.breakdown.genderCost },
                    { label: '재회 페널티', value: item.breakdown.reunionPenalty },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 p-3 rounded-lg flex flex-col items-start text-left">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</span>
                      <span className="font-medium text-slate-700">{value.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex flex-col items-start text-left">
                    <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-1">희망 조원 보상</span>
                    <span className="font-bold text-emerald-700">-{item.breakdown.requestReward.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
