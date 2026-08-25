import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import type { InterviewSchedule } from '../types';

interface Props {
  schedules: InterviewSchedule[];
  activeScheduleId: string | null;
  applicantCounts?: Readonly<Record<string, number>>;
  allowNone?: boolean;
  noneLabel?: string;
  onSelect: (scheduleId: string | null) => void;
}

function dateRange(schedule: InterviewSchedule) {
  const first = schedule.interviewDates[0];
  const last = schedule.interviewDates.at(-1);
  if (!first) return '날짜 미설정';
  const short = (value: string) => value.slice(5).replace('-', '/');
  return first === last ? short(first) : `${short(first)}–${short(last!)}`;
}

function statusLabel(schedule: InterviewSchedule) {
  if (schedule.status === 'collecting') return { label: '응답 수집 중', className: 'bg-emerald-50 text-emerald-700' };
  if (schedule.status === 'draft') return { label: '준비 중', className: 'bg-slate-100 text-slate-600' };
  if (schedule.status === 'finished') return { label: '완료', className: 'bg-slate-100 text-slate-500' };
  return { label: '응답 마감', className: 'bg-amber-50 text-amber-700' };
}

export default function InterviewScheduleSelector({ schedules, activeScheduleId, applicantCounts = {}, allowNone = false, noneLabel = '일정 선택', onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = schedules.find(schedule => schedule.id === activeScheduleId) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return <div ref={rootRef} className="relative min-w-0 sm:min-w-72">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-gold/60 hover:bg-slate-50">
      <span className="rounded-xl bg-slate-100 p-2 text-navy"><CalendarDays size={16} /></span>
      <span className="min-w-0 flex-1">{active ? <><strong className="block truncate text-xs font-black text-navy">{active.name}</strong><small className="mt-0.5 block text-[10px] font-bold text-slate-400">{dateRange(active)} · 지원자 {applicantCounts[active.id] ?? 0}명</small></> : <><strong className="block text-xs font-black text-navy">{noneLabel}</strong><small className="block text-[10px] text-slate-400">관리할 일정을 선택해주세요.</small></>}</span>
      <ChevronDown size={15} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="listbox" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl">
      {allowNone && <button type="button" role="option" aria-selected={!active} onClick={() => { onSelect(null); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${!active ? 'bg-amber-50' : 'hover:bg-slate-50'}`}><span className="min-w-0 flex-1"><strong className="block text-xs font-black text-navy">{noneLabel}</strong><small className="text-[10px] text-slate-400">회차에 공통으로 사용할 면접관</small></span>{!active && <Check size={15} className="text-gold" />}</button>}
      {schedules.map(schedule => { const status = statusLabel(schedule); const selected = schedule.id === activeScheduleId; return <button type="button" role="option" aria-selected={selected} key={schedule.id} onClick={() => { onSelect(schedule.id); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-xs font-black text-navy">{schedule.name}</strong><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${status.className}`}>{status.label}</span></span><small className="mt-1 block text-[10px] font-bold text-slate-400">{dateRange(schedule)} · 지원자 {applicantCounts[schedule.id] ?? 0}명</small></span>{selected && <Check size={15} className="shrink-0 text-gold" />}</button>; })}
      {schedules.length === 0 && <p className="px-3 py-5 text-center text-xs font-bold text-slate-400">아직 만든 면접 일정이 없습니다.</p>}
    </div>}
  </div>;
}
