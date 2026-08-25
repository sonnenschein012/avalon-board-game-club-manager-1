import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, UserRound } from 'lucide-react';
import type { InterviewApplicant, InterviewRound, InterviewRoundInterviewer } from '../types';
import AvailabilityGrid from './AvailabilityGrid';

interface Props {
  round: InterviewRound;
  interviewers: InterviewRoundInterviewer[];
  applicants: InterviewApplicant[];
  onAdd: (name: string, email?: string, phone?: string) => Promise<boolean>;
  onSaveAvailability: (participantId: string, availability: string[]) => Promise<boolean>;
  onSavePhone: (participant: InterviewRoundInterviewer, phone: string) => Promise<boolean>;
  onRemove: (participant: InterviewRoundInterviewer) => Promise<boolean>;
}

export default function InterviewersPanel({ round, interviewers, applicants, onAdd, onSaveAvailability, onSavePhone, onRemove }: Props) {
  const active = interviewers.filter(item => item.active);
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? '');
  const selected = active.find(item => item.id === selectedId) ?? active[0] ?? null;
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(selected?.phone ?? '');
  useEffect(() => setSelectedPhone(selected?.phone ?? ''), [selected?.id, selected?.phone]);
  const selectedSlots = draft ?? new Set(selected?.availability ?? []);
  const loads = useMemo(() => new Map(active.map(interviewer => [interviewer.interviewerId, applicants.filter(applicant => applicant.assignment?.interviewerId === interviewer.interviewerId).length])), [active, applicants]);
  const choose = (id: string) => { setSelectedId(id); setDraft(null); };
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
    <aside className="min-w-0 space-y-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><div><h3 className="font-black text-navy">면접관</h3><p className="mt-1 text-xs text-slate-400">이름으로 명시적으로 구분하며 이메일 연결은 선택 사항입니다.</p></div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:block xl:space-y-2 xl:overflow-visible xl:px-0 xl:pb-0">{active.map(interviewer => <button key={interviewer.id} onClick={() => choose(interviewer.id)} className={`flex min-w-40 shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left xl:w-full ${selected?.id === interviewer.id ? 'bg-navy text-white' : 'bg-slate-50 text-navy'}`}><span className="min-w-0"><strong className="block truncate text-xs">{interviewer.displayName}</strong><small className="block truncate opacity-60">{interviewer.phone ?? '연락처 미등록'}</small><small className="block truncate opacity-60">{interviewer.email ?? '로그인 연결 없음'}</small></span><span className="shrink-0 text-xs font-black">{loads.get(interviewer.interviewerId) ?? 0}명</span></button>)}</div>
      {selected && <div className="space-y-2 rounded-2xl bg-indigo-50 p-3"><label className="block text-[10px] font-black text-indigo-700">{selected.displayName} 연락용 전화번호<input value={selectedPhone} onChange={event => setSelectedPhone(event.target.value)} inputMode="tel" placeholder="010-0000-0000" className="mt-1 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs text-navy" /></label><button type="button" onClick={() => void onSavePhone(selected, selectedPhone)} className="flex w-full items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700"><Save size={13} />연락처 저장</button></div>}
      <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-1"><input value={name} onChange={event => setName(event.target.value)} placeholder="면접관 이름" className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="연락용 전화번호" inputMode="tel" className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input value={email} onChange={event => setEmail(event.target.value)} placeholder="로그인 이메일 (선택)" className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /><button disabled={!name.trim()} onClick={async () => { if (await onAdd(name, email || undefined, phone || undefined)) { setName(''); setEmail(''); setPhone(''); } }} className="flex w-full items-center justify-center gap-1 rounded-xl bg-gold px-3 py-2.5 text-xs font-black text-navy disabled:opacity-40 sm:col-span-2 xl:col-span-1"><Plus size={14} />면접관 추가</button></div>
    </aside>
    <section className="min-w-0 overflow-hidden rounded-3xl bg-white p-4 shadow-sm sm:p-5">{selected ? <><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><UserRound size={18} className="shrink-0 text-gold" /><div className="min-w-0"><h3 className="truncate font-black text-navy">{selected.displayName} 가능시간</h3><p className="text-xs text-slate-400">가로로 움직이며 칸을 누르거나 드래그해 선택하세요.</p></div></div><div className="flex w-full gap-2 sm:w-auto"><button aria-label={`${selected.displayName} 면접관 제외`} onClick={() => { if (window.confirm(`${selected.displayName} 면접관을 이 회차에서 제외할까요?`)) void onRemove(selected); }} className="shrink-0 rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 size={15} /></button><button onClick={() => void onSaveAvailability(selected.id, [...selectedSlots])} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white sm:flex-none"><Save size={14} />저장</button></div></div><AvailabilityGrid slots={round.allowedSlots} selected={selectedSlots} slotMinutes={round.availabilitySlotMinutes} onToggle={(slotId, force) => setDraft(current => { const next = new Set(current ?? selected.availability); const shouldSelect = force ?? !next.has(slotId); if (shouldSelect) next.add(slotId); else next.delete(slotId); return next; })} /></> : <p className="py-20 text-center text-sm text-slate-400">면접관을 먼저 추가해주세요.</p>}</section>
  </div>;
}
