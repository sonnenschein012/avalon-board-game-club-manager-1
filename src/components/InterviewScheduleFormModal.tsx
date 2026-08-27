import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Plus, Save, Trash2, X } from 'lucide-react';
import { generateAvailabilitySlotsForSchedules } from '../domain/interviews/scheduling';
import type { InterviewDaySchedule, InterviewRound, InterviewSchedule } from '../types';
import type { InterviewScheduleDraft } from '../services/interviewsService';

function toDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateFromKey(dateKey: string) { return new Date(`${dateKey}T00:00:00`); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }

export function datesInRange(startKey: string, endKey: string) {
  if (!startKey || !endKey) return [];
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (end < start) return [];
  const dates: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) dates.push(toDateKey(current));
  return dates;
}

function toInputDate(date: Date) { return Number.isFinite(date.getTime()) ? toDateKey(date) : ''; }
function toInputTime(date: Date) {
  if (!Number.isFinite(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function updateDatePart(current: Date, dateKey: string) {
  const next = dateFromKey(dateKey);
  next.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return next;
}
function updateTimePart(current: Date, time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const next = new Date(current);
  next.setHours(hour, minute, 0, 0);
  return next;
}
function dateWeekName(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return `${date.getMonth() + 1}월 ${Math.ceil((date.getDate() + start.getDay()) / 7)}주 면접`;
}

export function suggestedInterviewScheduleDraft(round: InterviewRound, schedules: InterviewSchedule[]): InterviewScheduleDraft {
  const configuredLastDate = schedules.flatMap(schedule => schedule.interviewDates).sort().at(-1);
  const earliest = addDays(new Date(), 3);
  const suggestedStart = configuredLastDate ? new Date(Math.max(earliest.getTime(), addDays(dateFromKey(configuredLastDate), 1).getTime())) : earliest;
  const dates = [0, 1, 2].map(offset => toDateKey(addDays(suggestedStart, offset)));
  return {
    name: dateWeekName(suggestedStart),
    surveyOpensAt: new Date(),
    surveyClosesAt: new Date(`${dates[0]}T00:00:00`),
    interviewDates: dates,
    dayStartTime: round.dayStartTime,
    dayEndTime: round.dayEndTime,
    availabilitySlotMinutes: round.availabilitySlotMinutes,
    assignmentSlotMinutes: round.availabilitySlotMinutes % 10 === 0 ? 10 : round.assignmentSlotMinutes,
    status: 'collecting',
    instructions: round.instructions,
    allowedSlots: [],
    daySchedules: dates.map(date => ({ date, startTime: round.dayStartTime, endTime: round.dayEndTime })),
  };
}

interface Props {
  open: boolean;
  round: InterviewRound;
  schedules: InterviewSchedule[];
  schedule?: InterviewSchedule | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: InterviewScheduleDraft, expectedScheduleRevision?: number) => Promise<boolean>;
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

function SurveyDateTimeCard({ label, value, onChange }: { label: string; value: Date; onChange: (value: Date) => void }) {
  return <fieldset className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3">
    <legend className="px-1 text-[11px] font-black text-navy">{label}</legend>
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
      <label className="min-w-0 text-[10px] font-bold text-slate-400">날짜<input type="date" value={toInputDate(value)} onChange={event => event.target.value && onChange(updateDatePart(value, event.target.value))} className="mt-1 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-navy" /></label>
      <label className="min-w-0 text-[10px] font-bold text-slate-400">시간<input type="time" value={toInputTime(value)} onChange={event => event.target.value && onChange(updateTimePart(value, event.target.value))} className="mt-1 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-navy" /></label>
    </div>
  </fieldset>;
}

export default function InterviewScheduleFormModal({ open, round, schedules, schedule, saving = false, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<InterviewScheduleDraft>(() => schedule ? scheduleToDraft(schedule) : suggestedInterviewScheduleDraft(round, schedules));
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const initializedOpenKey = useRef<string | null>(null);
  const loadedRevision = useRef<number | undefined>(schedule?.scheduleRevision);

  useEffect(() => {
    if (!open) { initializedOpenKey.current = null; return; }
    const key = schedule?.id ?? 'new';
    if (initializedOpenKey.current === key) return;
    initializedOpenKey.current = key;
    loadedRevision.current = schedule?.scheduleRevision;
    setDraft(schedule ? scheduleToDraft(schedule) : suggestedInterviewScheduleDraft(round, schedules));
    setRangeStart('');
    setRangeEnd('');
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
  const updateSchedule = (date: string, patch: Partial<InterviewDaySchedule>) => setDraft(current => ({ ...current, daySchedules: current.daySchedules.map(item => item.date === date ? { ...item, ...patch } : item) }));
  const addDateRange = () => {
    const dates = datesInRange(rangeStart, rangeEnd || rangeStart);
    if (dates.length === 0) return;
    setDraft(current => ({
      ...current,
      daySchedules: [...current.daySchedules, ...dates.filter(date => !current.daySchedules.some(item => item.date === date)).map(date => ({ date, startTime: current.dayStartTime, endTime: current.dayEndTime }))].sort((left, right) => left.date.localeCompare(right.date)),
    }));
    setRangeStart('');
    setRangeEnd('');
  };
  const submit = async () => {
    if (validationError || saving) return;
    const daySchedules = [...draft.daySchedules].sort((left, right) => left.date.localeCompare(right.date));
    await onSave({ ...draft, name: draft.name.trim(), interviewDates: daySchedules.map(item => item.date), dayStartTime: daySchedules.map(item => item.startTime).sort()[0] ?? draft.dayStartTime, dayEndTime: daySchedules.map(item => item.endTime).sort().at(-1) ?? draft.dayEndTime, daySchedules, allowedSlots: generatedSlots }, loadedRevision.current);
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-3">
    <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-navy p-2 text-white"><CalendarPlus size={18} /></span><div><h2 className="font-black text-navy">{schedule ? '면접 일정 수정' : '면접 일정 추가'}</h2><p className="text-[10px] text-slate-400">조사 기간과 실제 면접 가능일을 설정합니다.</p></div></div>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2 md:gap-5 md:p-5">
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div><h3 className="text-xs font-black uppercase tracking-wider text-navy">일정과 조사 기간</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">지원자 안내문은 회차 공통 설정의 내용을 사용합니다.</p></div>
          <label className="block text-xs font-bold text-slate-500">일정 이름<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="8월 4주 면접" /></label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"><SurveyDateTimeCard label="응답 시작" value={draft.surveyOpensAt} onChange={surveyOpensAt => setDraft({ ...draft, surveyOpensAt })} /><SurveyDateTimeCard label="응답 마감" value={draft.surveyClosesAt} onChange={surveyClosesAt => setDraft({ ...draft, surveyClosesAt })} /></div>
          <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-xs font-bold text-slate-500">응답 단위(분)<input type="number" min={5} value={draft.availabilitySlotMinutes} onChange={event => setDraft({ ...draft, availabilitySlotMinutes: Number(event.target.value) })} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2" /></label><label className="min-w-0 text-xs font-bold text-slate-500">배정 단위(분)<input type="number" min={5} value={draft.assignmentSlotMinutes} onChange={event => setDraft({ ...draft, assignmentSlotMinutes: Number(event.target.value) })} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2" /></label></div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div><h3 className="text-xs font-black uppercase tracking-wider text-navy">면접 날짜와 시간</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">연속된 범위를 추가한 뒤 필요 없는 날짜만 제외할 수 있습니다.</p></div>
          <div className="grid min-w-0 grid-cols-2 gap-2"><label className="min-w-0 text-[10px] font-bold text-slate-400">시작일<input type="date" value={rangeStart} onChange={event => { setRangeStart(event.target.value); if (!rangeEnd || rangeEnd < event.target.value) setRangeEnd(event.target.value); }} className="mt-1 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-2 py-2 text-xs text-navy" /></label><label className="min-w-0 text-[10px] font-bold text-slate-400">종료일<input type="date" min={rangeStart || undefined} value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} className="mt-1 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-2 py-2 text-xs text-navy" /></label></div>
          <button type="button" disabled={!rangeStart || !rangeEnd || rangeEnd < rangeStart} onClick={addDateRange} className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-navy disabled:opacity-40"><Plus size={14} />{rangeStart && rangeEnd ? `${datesInRange(rangeStart, rangeEnd).length}일 한 번에 추가` : '날짜 범위 선택'}</button>
          <div className="space-y-2">{draft.daySchedules.map(item => <article key={item.date} className="rounded-xl bg-slate-50 p-2.5"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-navy">{new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(dateFromKey(item.date))}</strong><button type="button" aria-label={`${item.date} 삭제`} onClick={() => setDraft(current => ({ ...current, daySchedules: current.daySchedules.filter(scheduleItem => scheduleItem.date !== item.date) }))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="min-w-0 text-[10px] font-bold text-slate-400">시작<input type="time" value={item.startTime} onChange={event => updateSchedule(item.date, { startTime: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-navy" /></label><label className="min-w-0 text-[10px] font-bold text-slate-400">종료<input type="time" value={item.endTime} onChange={event => updateSchedule(item.date, { endTime: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-navy" /></label></div></article>)}</div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-navy">생성될 응답 슬롯 {generatedSlots.length}개</p>
        </section>
      </div>

      <footer className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
        <p role={validationError ? 'alert' : undefined} className={`mb-2 text-xs font-bold sm:mb-0 ${validationError ? 'text-red-600' : 'text-emerald-600'}`}>{validationError ?? '저장 후 이 일정에 지원자를 지정할 수 있습니다.'}</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500">취소</button><button type="button" onClick={() => void submit()} disabled={saving || Boolean(validationError)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white disabled:opacity-40"><Save size={15} />{saving ? '저장 중...' : '저장'}</button></div>
      </footer>
    </div>
  </div>;
}
