import { useEffect, useState } from 'react';
import { CalendarPlus, Check, X } from 'lucide-react';
import type { InterviewSchedule } from '../types';

interface Props {
  open: boolean;
  applicantsCount: number;
  schedules: InterviewSchedule[];
  saving?: boolean;
  onClose: () => void;
  onAssign: (scheduleId: string) => Promise<boolean>;
  onCreateSchedule: () => void;
}

function formatRange(schedule: InterviewSchedule) {
  const first = schedule.interviewDates[0];
  const last = schedule.interviewDates.at(-1);
  if (!first) return '날짜 미설정';
  return first === last ? first : `${first} ~ ${last ?? first}`;
}

export default function InterviewScheduleAssignmentModal({ open, applicantsCount, schedules, saving = false, onClose, onAssign, onCreateSchedule }: Props) {
  const availableSchedules = schedules.filter(schedule => schedule.status !== 'archived');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  useEffect(() => {
    if (open) setSelectedScheduleId(schedules.find(schedule => schedule.status !== 'archived')?.id ?? '');
  }, [open, schedules]);
  if (!open) return null;
  const assign = async () => {
    if (!selectedScheduleId || saving) return;
    if (await onAssign(selectedScheduleId)) onClose();
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">{applicantsCount}명 선택됨</p><h2 className="mt-1 text-lg font-black text-navy">면접 일정 지정</h2><p className="mt-1 text-sm leading-5 text-slate-500">지원자를 넣을 기존 일정을 선택하거나 새 일정을 만드세요.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 space-y-2">{availableSchedules.map((schedule, index) => <label key={schedule.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${selectedScheduleId === schedule.id ? 'border-gold bg-amber-50' : 'border-slate-200 bg-white'}`}><input type="radio" name="interview-schedule" value={schedule.id} checked={selectedScheduleId === schedule.id} onChange={() => setSelectedScheduleId(schedule.id)} className="sr-only" /><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selectedScheduleId === schedule.id ? 'border-gold bg-gold text-navy' : 'border-slate-300 bg-white text-transparent'}`}><Check size={12} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-navy">{schedule.name}</strong><small className="mt-1 block text-xs text-slate-500">{formatRange(schedule)} · {schedule.status === 'collecting' ? '응답 수집 중' : '준비 중'}</small></span>{index === 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">추천</span>}</label>)}<button type="button" onClick={onCreateSchedule} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-3 py-3 text-left transition hover:bg-slate-50"><span className="rounded-xl bg-indigo-50 p-2 text-navy"><CalendarPlus size={16} /></span><span><strong className="block text-sm text-navy">새 면접 일정 만들기</strong><small className="mt-1 block text-xs text-slate-500">기본 3일 일정으로 날짜와 시간을 제안합니다.</small></span></button></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500">취소</button><button type="button" disabled={!selectedScheduleId || saving} onClick={() => void assign()} className="rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{saving ? '지정 중...' : '선택한 일정에 지정'}</button></div></div></div>;
}
