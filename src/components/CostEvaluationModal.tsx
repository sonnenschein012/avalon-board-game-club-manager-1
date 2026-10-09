import { Activity, X } from 'lucide-react';
import type { SessionGroup } from '../types';
import { combineScores, evaluateUtilityGroup, type UtilityContext } from '../domain/matching/personalUtility';
import AttendanceNotice from './AttendanceNotice';

interface CostEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SessionGroup[];
  context: UtilityContext | null;
}

export default function CostEvaluationModal({ isOpen, onClose, groups, context }: CostEvaluationModalProps) {
  if (!isOpen) return null;
  const breakdowns = context ? groups.map((group, index) => ({
    id: group.id, name: group.name || `TEAM ${index + 1}`,
    score: evaluateUtilityGroup(group.memberIds.filter(id => context.people.has(id)), context),
  })) : [];
  const total = combineScores(breakdowns.map(g => g.score), context?.parameters);
  const globalPeople = new Map(total.people.map(person => [person.id, person]));
  const assigned = new Set(groups.flatMap(g => g.memberIds));
  const partial = !context || assigned.size !== context.people.size || [...assigned].some(id => !context.people.has(id));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="개인 효용 평가">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-navy text-white">
          <h2 className="text-lg font-bold flex items-center gap-2"><Activity size={20} className="text-gold" />개인 효용 평가</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 hover:bg-slate-700 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto bg-slate-50 space-y-4">
          <p className="text-sm text-slate-600">동반 요청 충족 → 운영진 배치 → 개인 효용 순으로 비교합니다. 서로 다른 단계의 점수를 합산하지 않습니다.</p>
          <AttendanceNotice>현재 수치는 초기 운영값이며, 운영 사례에 따라 조정할 수 있습니다.{partial ? ' 미배정·미등록·결석 인원이 있어 현재 배치된 등록 참석자만 평가합니다.' : ''}</AttendanceNotice>
          <div className="grid grid-cols-2 gap-3 text-sm bg-white rounded-xl border p-4">
            <span>동반 요청 효용: {total.requestScore.toFixed(3)}</span>
            <span>운영진 없는 조: {total.boardMissing}개 (4명 외 {total.boardMissingNonFour}개)</span>
            <span>완화 후 개인 순효용 합: {total.totalUtility.toFixed(3)}</span>
            <span>보호·완화 적용 후 평가 합: {total.welfare.toFixed(3)}</span>
          </div>
          {breakdowns.map(group => <div key={group.id} className="bg-white rounded-xl border p-4">
            <h3 className="font-bold mb-3">{group.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right whitespace-nowrap">
                <thead><tr>{['이름', '동반 상대', '동성 효용', '이성 효용', '학번 비용', '재회 비용', '보호 기준 순효용', '환산 순효용', '보호 계수', '완화 계수', '완화 후 순효용', '개선 중요도', '평가 기여분'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
                <tbody>{group.score.people.map(local => globalPeople.get(local.id)!).map(person => <tr key={person.id} className="border-t">
                  <th className="p-2 text-left">{person.name}</th><td className="p-2">{person.requestCount}명</td>
                  {[person.sameUtility, person.otherUtility, person.yearCost, person.reunionCost, person.baseUtility, person.convertedUtility, person.protectionWeight, person.attenuation, person.utility, person.effectiveWeight, person.protectedUtility].map((value, i) => <td key={i} className="p-2">{value.toFixed(2)}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </div>)}
          <p className="text-xs text-slate-500">보호 기준 순효용 = 동성 효용 + 이성 효용 − 학번 비용 − 재회 비용. 보호는 완화 전 순효용을 기준으로 정하고, 평가 기여분에 완화를 적용합니다. 재회 비용은 완화하지 않습니다.</p>
          <p className="text-xs text-slate-500">환산 순효용은 전체 인원의 완화 비중을 반영한 평균을 빼고 고정 척도로 나눈 값입니다. 보호 계수는 1~2배, 성별·학번 항목의 개선 중요도는 보호 계수 × 완화 계수입니다. 완화 후 순효용은 보호 없이 완화만 적용한 참고값입니다. 성별·학번 정보가 없으면 해당 계산에서 제외합니다.</p>
        </div>
      </div>
    </div>
  );
}
