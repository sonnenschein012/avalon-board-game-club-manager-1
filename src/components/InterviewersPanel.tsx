import { useMemo, useState } from 'react';
import { Plus, Save, Trash2, UserRound } from 'lucide-react';
import type { InterviewApplicant, InterviewRound, InterviewRoundInterviewer } from '../types';
import AvailabilityGrid from './AvailabilityGrid';

interface Props {
  round: InterviewRound;
  interviewers: InterviewRoundInterviewer[];
  applicants: InterviewApplicant[];
  onAdd: (name: string, email?: string) => Promise<boolean>;
  onSaveAvailability: (participantId: string, availability: string[]) => Promise<boolean>;
  onRemove: (participant: InterviewRoundInterviewer) => Promise<boolean>;
}

export default function InterviewersPanel({ round, interviewers, applicants, onAdd, onSaveAvailability, onRemove }: Props) {
  const active = interviewers.filter(item => item.active);
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? '');
  const selected = active.find(item => item.id === selectedId) ?? active[0] ?? null;
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const selectedSlots = draft ?? new Set(selected?.availability ?? []);
  const loads = useMemo(() => new Map(active.map(interviewer => [interviewer.interviewerId, applicants.filter(applicant => applicant.assignment?.interviewerId === interviewer.interviewerId).length])), [active, applicants]);
  const choose = (id: string) => { setSelectedId(id); setDraft(null); };
  return <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
    <aside className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"><div><h3 className="font-black text-navy">면접관</h3><p className="mt-1 text-xs text-slate-400">이름으로 명시적으로 구분하며 이메일 연결은 선택 사항입니다.</p></div>
      <div className="space-y-2">{active.map(interviewer => <button key={interviewer.id} onClick={() => choose(interviewer.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left ${selected?.id === interviewer.id ? 'bg-navy text-white' : 'bg-slate-50 text-navy'}`}><span><strong className="block text-xs">{interviewer.displayName}</strong><small className="opacity-60">{interviewer.email ?? '로그인 연결 없음'}</small></span><span className="text-xs font-black">{loads.get(interviewer.interviewerId) ?? 0}명</span></button>)}</div>
      <div className="space-y-2 border-t border-slate-100 pt-4"><input value={name} onChange={event => setName(event.target.value)} placeholder="면접관 이름" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input value={email} onChange={event => setEmail(event.target.value)} placeholder="로그인 이메일 (선택)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /><button disabled={!name.trim()} onClick={async () => { if (await onAdd(name, email || undefined)) { setName(''); setEmail(''); } }} className="flex w-full items-center justify-center gap-1 rounded-xl bg-gold px-3 py-2.5 text-xs font-black text-navy disabled:opacity-40"><Plus size={14} />면접관 추가</button></div>
    </aside>
    <section className="rounded-3xl bg-white p-5 shadow-sm">{selected ? <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><UserRound size={18} className="text-gold" /><div><h3 className="font-black text-navy">{selected.displayName} 가능시간</h3><p className="text-xs text-slate-400">드래그하거나 셀을 눌러 선택하세요.</p></div></div><div className="flex gap-2"><button onClick={() => { if (window.confirm(`${selected.displayName} 면접관을 이 회차에서 제외할까요?`)) void onRemove(selected); }} className="rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 size={15} /></button><button onClick={() => void onSaveAvailability(selected.id, [...selectedSlots])} className="flex items-center gap-1 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white"><Save size={14} />저장</button></div></div><AvailabilityGrid slots={round.allowedSlots} selected={selectedSlots} slotMinutes={round.availabilitySlotMinutes} onToggle={(slotId, force) => setDraft(current => { const next = new Set(current ?? selected.availability); const shouldSelect = force ?? !next.has(slotId); if (shouldSelect) next.add(slotId); else next.delete(slotId); return next; })} /></> : <p className="py-20 text-center text-sm text-slate-400">면접관을 먼저 추가해주세요.</p>}</section>
  </div>;
}
