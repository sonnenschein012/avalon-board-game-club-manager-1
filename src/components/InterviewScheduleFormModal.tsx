import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { generateAvailabilitySlotsForSchedules } from '../domain/interviews/scheduling';
import type { InterviewDaySchedule, InterviewRound, InterviewSchedule } from '../types';
import type { InterviewScheduleDraft } from '../services/interviewsService';

function toDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateWeekName(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const week = Math.ceil((date.getDate() + start.getDay()) / 7);
  return `${date.getMonth() + 1}월 ${week}주 면접`;
}

export function suggestedInterviewScheduleDraft(round: InterviewRound, schedules: InterviewSchedule[]): InterviewScheduleDraft {
  const configuredLastDate = schedules.flatMap(schedule => schedule.interviewDates).sort().at(-1);
  const earliest = addDays(new Date(), 3);
  const suggestedStart = configuredLastDate
    ? new Date(Math.max(earliest.getTime(), addDays(dateFromKey(configuredLastDate), 1).getTime()))
    : earliest;
  const dates = [0, 1, 2].map(offset => toDateKey(addDays(suggestedStart, offset)));
  const daySchedules: InterviewDaySchedule[] = dates.map(date => ({
    date,
    startTime: round.dayStartTime,
    endTime: round.dayEndTime,
  }));
  const surveyClosesAt = new Date(`${dates[0]}T00:00:00`);
  return {
    name: dateWeekName(suggestedStart),
    surveyOpensAt: new Date(),
    surveyClosesAt,
    interviewDates: dates,
    dayStartTime: round.dayStartTime,
    dayEndTime: round.dayEndTime,
    availabilitySlotMinutes: round.availabilitySlotMinutes,
    assignmentSlotMinutes: round.assignmentSlotMinutes,
    status: 'collecting',
    instructions: round.instructions,
    allowedSlots: [],
    daySchedules,
  };
}

interface Props {
  open: boolean;
  round: InterviewRound;
  schedules: InterviewSchedule[];
  schedule?: InterviewSchedule | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: InterviewScheduleDraft) => Promise<boolean>;
}

function scheduleToDraft(schedule: InterviewSchedule): InterviewScheduleDraft {
  return {
    name: schedule.name,
    surveyOpensAt: schedule.surveyOpensAt.toDate(),
    surveyClosesAt: schedule.surveyClosesAt.toDate(),
    interviewDates: schedule.interviewDates,
    dayStartTime: schedule.dayStartTime,
    dayEndTime: schedule.dayEndTime,
    availabilitySlotMinutes: schedule.availabilitySlotMinutes,
    assignmentSlotMinutes: schedule.assignmentSlotMinutes,
    status: schedule.status === 'archived' ? 'closed' : schedule.status,
    instructions: schedule.instructions,
    allowedSlots: schedule.allowedSlots,
    daySchedules: schedule.daySchedules,
  };
}

export default function InterviewScheduleFormModal({ open, round, schedules, schedule, saving = false, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<InterviewScheduleDraft>(() => schedule ? scheduleToDraft(schedule) : suggestedInterviewScheduleDraft(round, schedules));
  const [dateToAdd, setDateToAdd] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(schedule ? scheduleToDraft(schedule) : suggestedInterviewScheduleDraft(round, schedules));
    setDateToAdd('');
  }, [open, round, schedule, schedules]);

  const generatedSlots = useMemo(() => {
    try { return generateAvailabilitySlotsForSchedules(draft.daySchedules, draft.availabilitySlotMinutes); }
    catch { return []; }
  }, [draft.availabilitySlotMinutes, draft.daySchedules]);
  const validationError = useMemo(() => {
    if (!draft.name.trim()) return '면접 일정 이름을 입력해주세요.';
    if (draft.surveyClosesAt <= draft.surveyOpensAt) return '응답 마감은 시작보다 뒤여야 합니다.';
    if (draft.daySchedules.length === 0) return '면접 날짜를 하나 이상 추가해주세요.';
    if (!Number.isInteger(draft.availabilitySlotMinutes) || draft.availabilitySlotMinutes <= 0) return '응답 단위를 확인해주세요.';
    if (!Number.isInteger(draft.assignmentSlotMinutes) || draft.assignmentSlotMinutes <= 0 || draft.availabilitySlotMinutes % draft.assignmentSlotMinutes !== 0) return '배정 단위는 응답 단위를 정확히 나누어야 합니다.';
    if (generatedSlots.length === 0) return '날짜별 시작·종료 시간을 확인해주세요.';
    return null;
  }, [draft, generatedSlots.length]);

  if (!open) return null;
  const updateSchedule = (date: string, patch: Partial<InterviewDaySchedule>) => setDraft(current => ({
    ...current,
    daySchedules: current.daySchedules.map(item => item.date === date ? { ...item, ...patch } : item),
  }));
  const addDate = () => {
    if (!dateToAdd || draft.daySchedules.some(item => item.date === dateToAdd)) return;
    setDraft(current => ({
      ...current,
      daySchedules: [...current.daySchedules, { date: dateToAdd, startTime: current.dayStartTime, endTime: current.dayEndTime }].sort((left, right) => left.date.localeCompare(right.date)),
    }));
    setDateToAdd('');
  };
  const submit = async () => {
    if (validationError || saving) return;
    const daySchedules = [...draft.daySchedules].sort((left, right) => left.date.localeCompare(right.date));
    await onSave({
      ...draft,
      name: draft.name.trim(),
      interviewDates: daySchedules.map(item => item.date),
      dayStartTime: daySchedules.map(item => item.startTime).sort()[0] ?? draft.dayStartTime,
      dayEndTime: daySchedules.map(item => item.endTime).sort().at(-1) ?? draft.dayEndTime,
      daySchedules,
      allowedSlots: generatedSlots,
    });
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-navy p-2 text-white"><CalendarPlus size={18} /></span><div><h2 className="font-black text-navy">{schedule ? '면접 일정 수정' : '면접 일정 추가'}</h2><p className="text-[10px] uppercase text-slate-400">Interview schedule</p></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2"><section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm"><h3 className="text-xs font-black uppercase tracking-wider text-navy">기본 정보</h3><label className="block text-xs font-bold text-slate-500">일정 이름<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="8월 4주 면접" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">응답 시작<input type="datetime-local" value={toInputDateTime(draft.surveyOpensAt)} onChange={event => event.target.value && setDraft({ ...draft, surveyOpensAt: new Date(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label><label className="text-xs font-bold text-slate-500">응답 마감<input type="datetime-local" value={toInputDateTime(draft.surveyClosesAt)} onChange={event => event.target.value && setDraft({ ...draft, surveyClosesAt: new Date(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">응답 단위(분)<input type="number" min={5} value={draft.availabilitySlotMinutes} onChange={event => setDraft({ ...draft, availabilitySlotMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-xs font-bold text-slate-500">배정 단위(분)<input type="number" min={5} value={draft.assignmentSlotMinutes} onChange={event => setDraft({ ...draft, assignmentSlotMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label></div><label className="block text-xs font-bold text-slate-500">지원자 안내문<textarea value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label></section><section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"><div><h3 className="text-xs font-black uppercase tracking-wider text-navy">면접 날짜와 시간</h3><p className="mt-1 text-[11px] text-slate-400">날짜별 시간 범위는 각각 따로 설정할 수 있습니다.</p></div><div className="flex gap-2"><input type="date" value={dateToAdd} onChange={event => setDateToAdd(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={addDate} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-navy"><Plus size={14} />추가</button></div><div className="space-y-2">{draft.daySchedules.map(item => <div key={item.date} className="grid grid-cols-[1fr_88px_88px_auto] items-end gap-2 rounded-xl bg-slate-50 p-2"><span className="pb-2 text-xs font-black text-navy">{new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(dateFromKey(item.date))}</span><label className="text-[10px] font-bold text-slate-400">시작<input type="time" value={item.startTime} onChange={event => updateSchedule(item.date, { startTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-navy" /></label><label className="text-[10px] font-bold text-slate-400">종료<input type="time" value={item.endTime} onChange={event => updateSchedule(item.date, { endTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-navy" /></label><button type="button" aria-label={`${item.date} 삭제`} onClick={() => setDraft(current => ({ ...current, daySchedules: current.daySchedules.filter(scheduleItem => scheduleItem.date !== item.date) }))} className="mb-0.5 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></div>)}</div><p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-navy">생성될 응답 슬롯 {generatedSlots.length}개</p></section></div><div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p role={validationError ? 'alert' : undefined} className={`text-xs font-bold ${validationError ? 'text-red-600' : 'text-emerald-600'}`}>{validationError ?? '저장 후 이 일정에 지원자를 지정할 수 있습니다.'}</p><div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500">취소</button><button type="button" onClick={() => void submit()} disabled={saving || Boolean(validationError)} className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white disabled:opacity-40"><Save size={15} />{saving ? '저장 중...' : '저장'}</button></div></div></div></div>;
}
