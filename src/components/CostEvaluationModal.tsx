import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { combineScores, evaluateUtilityGroup, type PersonScore, type UtilityContext } from '../domain/matching/personalUtility';
import type { SessionGroup } from '../types';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy';

const detailedValues = (person: PersonScore): [string, string][] => [
  ['동반 상대', `${person.requestCount}명`], ['동성 효용', person.sameUtility.toFixed(2)], ['이성 효용', person.otherUtility.toFixed(2)],
  ['학번 비용', person.yearCost.toFixed(2)], ['재회 비용', person.reunionCost.toFixed(2)], ['보호 기준 순효용', person.baseUtility.toFixed(2)],
  ['환산 순효용', person.convertedUtility.toFixed(2)], ['보호 계수', person.protectionWeight.toFixed(2)], ['완화 계수', person.attenuation.toFixed(2)],
  ['완화 후 순효용', person.utility.toFixed(2)], ['개선 중요도', person.effectiveWeight.toFixed(2)], ['평가 기여분', person.protectedUtility.toFixed(2)],
];

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
    <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">{note}</p>
  </div>;
}

function ReadingGuide({ person, scale }: { person: PersonScore | undefined; scale: number | undefined }) {
  return <details className="group mt-7 border-t border-slate-100 pt-3">
    <summary className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium text-slate-600 [&::-webkit-details-marker]:hidden ${focus}`}>지표를 읽는 방법<ChevronDown size={16} className="group-open:rotate-180" /></summary>
    <div className="mt-4 space-y-6 text-sm leading-6 text-slate-600">
      <section>
        <h3 className="mb-2 font-semibold text-navy">편성을 비교할 때</h3>
        <p>먼저 동반 요청, 다음으로 운영진 배치를 확인합니다. 앞선 두 단계의 평가가 같을 때 전체 평가 합이 높은 편성을 선호합니다. 개인 수치는 한 사람에게 어떤 이점과 부담이 생겼는지 살펴보는 데 씁니다.</p>
      </section>
      <dl className="space-y-5">
        <div><dt className="font-semibold text-navy">순효용 · 관계의 이점에서 부담을 뺀 값</dt><dd className="mt-1">동성 효용 + 이성 효용 − 학번 비용 − 재회 비용입니다. 보호와 요청 완화를 적용하기 전 값이며, 높을수록 이점이 더 크거나 부담이 더 적은 배치입니다.</dd>
          {person && <dd className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 tabular-nums">{person.name}님: {person.sameUtility.toFixed(2)} + {person.otherUtility.toFixed(2)} − {person.yearCost.toFixed(2)} − {person.reunionCost.toFixed(2)} ≈ {person.baseUtility.toFixed(2)}<span className="mt-1 block text-slate-500">각 항목을 반올림해 표시하므로 끝자리에는 차이가 있을 수 있습니다.</span></dd>}
        </div>
        <div><dt className="font-semibold text-navy">환산 순효용 · 이번 편성의 기준보다 높은지</dt><dd className="mt-1">순효용이 기준 평균보다 높으면 양수, 낮으면 음수입니다. 기준 평균에는 각 사람의 요청 완화 비중을 반영하고, 평균과의 차이는 고정 척도 {scale ?? 2}로 나눕니다. 순효용 자체가 음수인지와는 다른 뜻입니다.</dd></div>
        <div><dt className="font-semibold text-navy">보호 계수 · 상대적으로 불리한 사람의 개선을 더 반영</dt><dd className="mt-1">현재 편성에서 순효용이 상대적으로 낮은 사람의 개선에 더 큰 비중을 줍니다. 범위는 1~2배입니다. 이것만 보고 요청 완화 이후의 실제 영향까지 판단하지는 않습니다.</dd></div>
        <div><dt className="font-semibold text-navy">완화 계수 · 동반 요청을 충족했으니 다른 조건은 덜 반영</dt><dd className="mt-1">동반 요청으로 연결된 상대가 같은 조에 있으면 성별·학번 조건의 영향을 줄입니다. 1은 완화 없음, 1보다 작은 값은 일부 완화입니다. 보호를 판단한 뒤 적용하며, 재회 비용은 완화하지 않습니다.</dd></div>
        <div><dt className="font-semibold text-navy">개선 중요도 · 지금 조금 개선하면 전체 평가에 얼마나 반영되는지</dt><dd className="mt-1">보호 계수 × 완화 계수입니다. 성별 효용이 조금 늘거나 학번 비용이 조금 줄었을 때의 영향을 나타냅니다. 재회 비용에는 별도 보정이 있어 이 배수를 그대로 적용하지 않습니다.</dd></div>
        <div><dt className="font-semibold text-navy">평가 기여분 · 전체 평가 합에 들어가는 이 사람의 몫</dt><dd className="mt-1">모든 사람의 평가 기여분을 더하면 전체 평가 합이 됩니다. 보호가 비선형이므로 순효용 × 개선 중요도로 계산한 값과는 다릅니다.</dd></div>
        <div><dt className="font-semibold text-navy">완화 후 순효용 · 보호를 제외하고 보는 참고값</dt><dd className="mt-1">요청 완화만 적용한 값입니다. 전체 평가 합을 만드는 최종 기여분과 구분해서 봅니다.</dd></div>
      </dl>
      <p className="border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">비교는 같은 참석자와 같은 파라미터의 편성끼리 합니다. 수치는 실제 만족도를 측정한 값이 아닙니다. 성별·학번 정보가 없으면 해당 항목의 계산에서 제외합니다.</p>
    </div>
  </details>;
}

function EvaluationDialog({ groups, context, onClose }: { groups: SessionGroup[]; context: UtilityContext | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [personId, setPersonId] = useState('');
  const breakdowns = context ? groups.map(group => ({ ...group, score: evaluateUtilityGroup(group.memberIds.filter(id => context.people.has(id)), context) })) : [];
  const total = combineScores(breakdowns.map(group => group.score), context?.parameters);
  const people = new Map(total.people.map(person => [person.id, person]));
  const activeGroup = breakdowns.find(group => group.id === groupId) ?? breakdowns[0];
  const activePeople = activeGroup?.score.people.map(person => people.get(person.id)!) ?? [];
  const activePerson = activePeople.find(person => person.id === personId) ?? activePeople[0];
  const requestPairs = [...(context?.requests.values() ?? [])];
  const fulfilled = requestPairs.filter(([first, second]) => groups.some(group => group.memberIds.includes(first) && group.memberIds.includes(second))).length;
  const nonemptyGroupCount = breakdowns.filter(group => group.score.people.length > 0).length;
  const partial = !context || people.size !== context.people.size || groups.some(group => group.memberIds.some(id => !context.people.has(id)));
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="evaluation-title" onCancel={event => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-hidden rounded-3xl border border-slate-100 bg-white p-0 text-navy shadow-xl backdrop:bg-navy/35 backdrop:backdrop-blur-sm">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
        <div><h2 id="evaluation-title" className="text-xl font-semibold">편성 평가</h2><p className="mt-2 text-sm leading-6 text-slate-500">현재 배치를 참여자별 효용과 비용으로 살펴봅니다.</p></div>
        <button type="button" onClick={onClose} aria-label="닫기" className={`-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 ${focus}`}><X size={20} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-8 sm:px-8">
        {context && <section aria-label="전체 편성 요약" className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 px-4 py-4 sm:gap-8 sm:px-6 sm:py-5">
          <Metric label="동반 요청" value={`${fulfilled} / ${requestPairs.length}쌍`} note={!requestPairs.length ? '확인된 동반 요청이 없습니다' : fulfilled === requestPairs.length ? '확인된 요청을 모두 충족했습니다' : '같은 조에 없는 요청 상대가 있습니다'} />
          <Metric label="운영진 배치" value={`${nonemptyGroupCount - total.boardMissing} / ${nonemptyGroupCount}개 조`} note={total.boardMissing ? `운영진 없는 조 ${total.boardMissing}개` : '모든 평가 대상 조에 운영진이 있습니다'} />
          <Metric label="전체 평가 합" value={total.welfare.toFixed(2)} note="보호·완화 적용 후 기여분의 합" />
        </section>}
        {context && partial && <p className="mt-4 text-xs leading-5 text-slate-500">미배정·미등록·결석 인원은 개인 평가에 포함하지 않습니다. 현재 배치된 등록 참석자 {people.size}명을 평가합니다.</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">{context ? '동반 요청 → 운영진 배치 → 개인 효용 순으로 판단합니다.' : '평가 자료를 사용할 수 없습니다. 명단과 이력의 조회 상태를 확인해주세요.'}</p>
        <section className="mt-7" aria-label="조별 개인 평가">
          <div className="mb-6 flex flex-wrap gap-2" aria-label="평가할 조 선택">
            {breakdowns.map(group => <button type="button" key={group.id} aria-pressed={group.id === activeGroup?.id} onClick={() => { setGroupId(group.id); setPersonId(''); }}
              className={`inline-flex min-h-11 items-center gap-3 rounded-xl px-5 text-sm font-semibold transition-colors ${focus} ${group.id === activeGroup?.id ? 'bg-navy text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              {group.name || '이름 없는 조'}<span className={`text-xs font-normal ${group.id === activeGroup?.id ? 'text-slate-200' : 'text-slate-500'}`}>{group.score.people.length}명</span>
            </button>)}
          </div>
          {activePerson ? <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium md:hidden">평가할 조원<select value={activePerson.id} onChange={event => setPersonId(event.target.value)} className={`mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm ${focus}`}>
                {activePeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select></label>
              <div className="hidden md:block">
                <div className="mb-3 flex justify-between px-4 text-xs text-slate-500"><span>조원</span><span>순효용 / 평가 기여분</span></div>
                <div className="space-y-2">{activePeople.map(person => <button type="button" key={person.id} aria-pressed={person.id === activePerson.id} onClick={() => setPersonId(person.id)}
                  className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${focus} ${person.id === activePerson.id ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{person.name}</span><span className="mt-1 block text-xs text-slate-500">{person.requestCount ? `동반 상대 ${person.requestCount}명` : '동반 요청 없음'}</span></span>
                  <span className="flex items-center gap-3"><span className="text-sm tabular-nums"><span className="text-slate-500">{person.baseUtility.toFixed(2)}</span><span className="mx-2 text-slate-300">/</span><span className="font-semibold">{person.protectedUtility.toFixed(2)}</span></span><ChevronRight size={16} className="shrink-0 text-slate-400" /></span>
                </button>)}</div>
              </div>
            </div>
            <section aria-label={`${activePerson.name} 세부 지표`} className="rounded-2xl bg-slate-50 p-5 sm:p-6">
              <h3 className="text-base font-semibold">{activePerson.name}</h3><p className="mt-1 text-xs text-slate-500">{activeGroup?.name} · 개인별 세부 평가</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">{detailedValues(activePerson).map(([label, value]) => <div key={label}><dt className="text-xs leading-5 text-slate-500">{label}</dt><dd className={`mt-1 text-sm tabular-nums ${label === '평가 기여분' ? 'font-semibold' : 'font-medium'}`}>{value}</dd></div>)}</dl>
            </section>
          </div> : <p className="rounded-2xl bg-slate-50 px-5 py-8 text-sm leading-6 text-slate-500">{groups.length ? '이 조에 평가할 등록 참석자가 없습니다.' : '조에 참석자를 배치하면 개인별 지표를 확인할 수 있습니다.'}</p>}
        </section>
        <ReadingGuide person={activePerson} scale={context?.parameters.protectionS} />
        {context && <p className="mt-4 text-xs leading-6 text-slate-500">참고: 완화 후 순효용 합 {total.totalUtility.toFixed(3)} · 동반 요청 효용 {total.requestScore.toFixed(3)} · 운영진 없는 조 {total.boardMissing}개 중 4명 외 {total.boardMissingNonFour}개</p>}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:px-8">
        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-500">현재 수치는 초기 운영값이며, 운영 사례에 따라 조정할 수 있습니다.</p>
        <button type="button" onClick={onClose} className={`min-h-11 shrink-0 rounded-xl bg-slate-100 px-5 text-sm font-semibold transition-colors hover:bg-slate-200 ${focus}`}>닫기</button>
      </footer>
    </div>
  </dialog>;
}

interface CostEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SessionGroup[];
  context: UtilityContext | null;
}

export default function CostEvaluationModal({ isOpen, ...props }: CostEvaluationModalProps) {
  return isOpen ? <EvaluationDialog {...props} /> : null;
}
