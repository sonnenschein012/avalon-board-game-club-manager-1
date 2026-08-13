import { useEffect, useMemo, useState } from 'react';
import { X, Save, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { InterviewRound } from '../types';
import {
  generateAvailabilitySlotsForSchedules,
  parseSlotId,
  type InterviewDaySchedule,
} from '../domain/interviews/scheduling';
import type { InterviewRoundDraft } from '../services/interviewsService';

export function roundToDraft(round?: InterviewRound | null): InterviewRoundDraft {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dates = round?.interviewDates ?? [];
  const dayStartTime = round?.dayStartTime ?? '10:00';
  const dayEndTime = round?.dayEndTime ?? '22:00';
  const availabilitySlotMinutes = round?.availabilitySlotMinutes ?? 30;
  return {
    name: round?.name ?? '',
    surveyOpensAt: round?.surveyOpensAt.toDate() ?? tomorrow,
    surveyClosesAt: round?.surveyClosesAt.toDate() ?? nextWeek,
    interviewDates: dates,
    dayStartTime,
    dayEndTime,
    availabilitySlotMinutes,
    assignmentSlotMinutes: round?.assignmentSlotMinutes ?? 5,
    // Kept in persisted documents for backward compatibility. Whether the
    // public form is open is derived only from the configured date range.
    status: 'collecting',
    instructions: round?.instructions ?? '되도록 가능한 시간을 모두 선택해주세요. 선택하신 시간 중 운영진이 실제 면접 시간을 확정해 별도로 안내드립니다.',
    messageTemplates: round?.messageTemplates ?? {
      availability: '{name} 님의 면접 가능 시간을 {deadline}까지 선택해주세요. {link}',
      reminder: '{name} 님, 아직 면접 가능 시간 응답이 확인되지 않았습니다. {deadline}까지 제출해주세요. {link}',
      confirmation: '{name} 님의 면접 시간이 {interviewDate} {interviewTime}으로 확정되었습니다.',
    },
    allowedSlots: round?.allowedSlots ?? [],
  };
}

function toInputDateTime(date: Date) {
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function timeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;
  const next = (minutes + minutesToAdd) % (24 * 60);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function monthFromDateKey(dateKey: string) {
  const [yearText = String(new Date().getFullYear()), monthText = '1'] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(year, month - 1, 1);
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateKey}T00:00:00`));
}

function getCalendarCells(month: Date): Array<string | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? toDateKey(new Date(year, monthIndex, day)) : null;
  });
}

function schedulesFromDraft(draft: InterviewRoundDraft): InterviewDaySchedule[] {
  const timesByDate = new Map<string, string[]>();
  draft.allowedSlots.forEach(slotId => {
    const parsed = parseSlotId(slotId);
    if (!parsed) return;
    const times = timesByDate.get(parsed.date) ?? [];
    times.push(parsed.time);
    timesByDate.set(parsed.date, times);
  });
  const dates = new Set([...draft.interviewDates, ...timesByDate.keys()]);

  return [...dates].sort().map(date => {
    const times = [...new Set(timesByDate.get(date) ?? [])].sort();
    const firstTime = times[0];
    const lastTime = times.at(-1);
    return {
      date,
      startTime: firstTime ?? draft.dayStartTime,
      endTime: lastTime ? addMinutesToTime(lastTime, draft.availabilitySlotMinutes) : draft.dayEndTime,
    };
  });
}

function MultiDateCalendar({
  month,
  addedDates,
  pendingDates,
  activeDate,
  onMonthChange,
  onDateClick,
}: {
  month: Date;
  addedDates: Set<string>;
  pendingDates: Set<string>;
  activeDate: string | null;
  onMonthChange: (month: Date) => void;
  onDateClick: (date: string) => void;
}) {
  const monthLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(month);
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="이전 달" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"><ChevronLeft size={17} /></button>
        <strong className="text-sm text-navy">{monthLabel}</strong>
        <button type="button" aria-label="다음 달" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"><ChevronRight size={17} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map(day => <span key={day} className="py-1 text-[10px] font-bold text-slate-400">{day}</span>)}
        {getCalendarCells(month).map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const isAdded = addedDates.has(date);
          const isPending = pendingDates.has(date);
          const isActive = activeDate === date;
          return (
            <button
              type="button"
              key={date}
              aria-pressed={isPending || isAdded}
              aria-label={`${formatDateLabel(date)} ${isAdded ? '일정 편집' : isPending ? '추가 선택 취소' : '추가 선택'}`}
              onClick={() => onDateClick(date)}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold transition ${isPending ? 'bg-navy text-white shadow-sm' : isAdded ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100'} ${isActive ? 'ring-2 ring-gold ring-offset-1' : ''}`}
            >
              {Number(date.slice(-2))}
              {isAdded && <Check size={9} className="absolute right-1 top-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface InterviewRoundFormModalProps {
  open: boolean;
  round?: InterviewRound | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: InterviewRoundDraft) => Promise<boolean | void>;
}

export default function InterviewRoundFormModal({ open, round, saving = false, onClose, onSave }: InterviewRoundFormModalProps) {
  const [draft, setDraft] = useState<InterviewRoundDraft>(() => roundToDraft(round));
  const [daySchedules, setDaySchedules] = useState<InterviewDaySchedule[]>(() => schedulesFromDraft(roundToDraft(round)));
  const [pendingDates, setPendingDates] = useState<string[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(() => schedulesFromDraft(roundToDraft(round))[0]?.date ?? null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDateKey(schedulesFromDraft(roundToDraft(round))[0]?.date ?? toDateKey(new Date())));
  const [internalSaving, setInternalSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const nextDraft = roundToDraft(round);
      const nextSchedules = schedulesFromDraft(nextDraft);
      setDraft(nextDraft);
      setDaySchedules(nextSchedules);
      setPendingDates([]);
      setActiveDate(nextSchedules[0]?.date ?? null);
      setCalendarMonth(monthFromDateKey(nextSchedules[0]?.date ?? toDateKey(new Date())));
      setInternalSaving(false);
    }
  }, [open, round]);

  const generatedSlots = useMemo(() => {
    try {
      return generateAvailabilitySlotsForSchedules(daySchedules, draft.availabilitySlotMinutes);
    } catch {
      return [];
    }
  }, [daySchedules, draft.availabilitySlotMinutes]);

  const validationError = useMemo(() => {
    if (!draft.name.trim()) return '회차명을 입력해주세요.';
    if (!Number.isFinite(draft.surveyOpensAt.getTime()) || !Number.isFinite(draft.surveyClosesAt.getTime())) return '조사 시작과 마감 일시를 입력해주세요.';
    if (draft.surveyClosesAt <= draft.surveyOpensAt) return '조사 마감은 시작보다 뒤여야 합니다.';
    if (daySchedules.length === 0) return '면접 날짜를 하나 이상 추가해주세요.';
    if (!Number.isInteger(draft.availabilitySlotMinutes) || draft.availabilitySlotMinutes <= 0) return '응답 단위는 양의 정수여야 합니다.';
    if (!Number.isInteger(draft.assignmentSlotMinutes) || draft.assignmentSlotMinutes <= 0) return '배정 단위는 양의 정수여야 합니다.';
    if (draft.availabilitySlotMinutes % draft.assignmentSlotMinutes !== 0) return '배정 단위는 응답 단위를 정확히 나눌 수 있어야 합니다. 예: 30분 응답에는 5분 또는 10분 배정.';
    for (const schedule of daySchedules) {
      const start = timeToMinutes(schedule.startTime);
      const end = timeToMinutes(schedule.endTime);
      if (start === null || end === null || end <= start) return `${formatDateLabel(schedule.date)}의 종료 시간을 시작 시간보다 뒤로 설정해주세요.`;
      if ((end - start) % draft.availabilitySlotMinutes !== 0) return `${formatDateLabel(schedule.date)}의 시간 범위를 응답 단위로 정확히 나누어주세요.`;
    }
    if (generatedSlots.length === 0) return '날짜별 시간 범위를 확인해주세요.';
    return null;
  }, [daySchedules, draft, generatedSlots.length]);

  const addedDateSet = useMemo(() => new Set(daySchedules.map(schedule => schedule.date)), [daySchedules]);
  const pendingDateSet = useMemo(() => new Set(pendingDates), [pendingDates]);
  const activeSchedule = daySchedules.find(schedule => schedule.date === activeDate) ?? null;

  const handleCalendarDateClick = (date: string) => {
    if (addedDateSet.has(date)) {
      setActiveDate(date);
      return;
    }
    setPendingDates(current => current.includes(date)
      ? current.filter(item => item !== date)
      : [...current, date].sort());
  };

  const addPendingDates = () => {
    if (pendingDates.length === 0) return;
    const defaultSchedule = activeSchedule ?? daySchedules.at(-1);
    const nextSchedules = [
      ...daySchedules,
      ...pendingDates.map(date => ({
        date,
        startTime: defaultSchedule?.startTime ?? draft.dayStartTime,
        endTime: defaultSchedule?.endTime ?? draft.dayEndTime,
      })),
    ].sort((left, right) => left.date.localeCompare(right.date));
    setDaySchedules(nextSchedules);
    setActiveDate(pendingDates[0] ?? null);
    setPendingDates([]);
  };

  const removeSchedule = (date: string) => {
    const nextSchedules = daySchedules.filter(schedule => schedule.date !== date);
    setDaySchedules(nextSchedules);
    if (activeDate === date) setActiveDate(nextSchedules[0]?.date ?? null);
  };

  const updateActiveSchedule = (patch: Partial<Pick<InterviewDaySchedule, 'startTime' | 'endTime'>>) => {
    if (!activeDate) return;
    setDaySchedules(current => current.map(schedule => schedule.date === activeDate ? { ...schedule, ...patch } : schedule));
  };

  if (!open) return null;

  const submit = async () => {
    if (validationError || internalSaving || saving) return;
    setInternalSaving(true);
    try {
      const sortedSchedules = [...daySchedules].sort((left, right) => left.date.localeCompare(right.date));
      const saved = await onSave({
        ...draft,
        name: draft.name.trim(),
        interviewDates: sortedSchedules.map(schedule => schedule.date),
        dayStartTime: sortedSchedules.map(schedule => schedule.startTime).sort()[0] ?? draft.dayStartTime,
        dayEndTime: sortedSchedules.map(schedule => schedule.endTime).sort().at(-1) ?? draft.dayEndTime,
        allowedSlots: generatedSlots,
      });
      if (saved !== false) onClose();
    } finally {
      setInternalSaving(false);
    }
  };

  const busy = saving || internalSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-8">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 md:px-7">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-navy p-2 text-white"><CalendarDays size={18} /></span>
            <div><h2 className="font-black text-navy">{round ? '면접 회차 수정' : '새 면접 회차'}</h2><p className="text-[10px] uppercase text-slate-400">Interview round settings</p></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2 md:p-7">
          <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">기본 설정</h3>
            <label className="block text-xs font-bold text-slate-500">회차명<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="2026-2 아발론 5기 신입부원 면접" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-500">조사 시작<input type="datetime-local" value={toInputDateTime(draft.surveyOpensAt)} onChange={event => { if (event.target.value) setDraft({ ...draft, surveyOpensAt: new Date(event.target.value) }); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
              <label className="text-xs font-bold text-slate-500">조사 마감<input type="datetime-local" value={toInputDateTime(draft.surveyClosesAt)} onChange={event => { if (event.target.value) setDraft({ ...draft, surveyClosesAt: new Date(event.target.value) }); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
            </div>
            <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold leading-relaxed text-emerald-700">응답 가능 여부는 조사 시작·마감 시각에 따라 자동으로 바뀝니다.</p>
            <label className="block text-xs font-bold text-slate-500">지원자 안내문<textarea value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">면접 일정</h3>
            <div>
              <p className="mb-2 text-xs leading-5 text-slate-500">추가할 날짜를 달력에서 여러 개 탭한 뒤 한 번에 추가할 수 있습니다.</p>
              <MultiDateCalendar
                month={calendarMonth}
                addedDates={addedDateSet}
                pendingDates={pendingDateSet}
                activeDate={activeDate}
                onMonthChange={setCalendarMonth}
                onDateClick={handleCalendarDateClick}
              />
              <button
                type="button"
                disabled={pendingDates.length === 0}
                onClick={addPendingDates}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-xs font-black text-white hover:bg-gold disabled:opacity-40"
              >
                <Plus size={15} /> {pendingDates.length > 0 ? `선택한 ${pendingDates.length}일 추가` : '날짜를 선택해주세요'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">추가된 날짜 · 탭하여 시간 수정</p>
              {daySchedules.length > 0 ? daySchedules.map(schedule => (
                <div key={schedule.date} className={`flex items-center gap-2 rounded-xl border p-1.5 transition ${activeDate === schedule.date ? 'border-gold bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                  <button type="button" onClick={() => { setActiveDate(schedule.date); setCalendarMonth(monthFromDateKey(schedule.date)); }} className="min-w-0 flex-1 px-2 py-1 text-left">
                    <span className="block text-xs font-black text-navy">{formatDateLabel(schedule.date)}</span>
                    <span className="text-[11px] font-bold text-slate-500">{schedule.startTime}~{schedule.endTime}</span>
                  </button>
                  <button type="button" aria-label={`${formatDateLabel(schedule.date)} 삭제`} onClick={() => removeSchedule(schedule.date)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              )) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">아직 추가된 면접 날짜가 없습니다.</p>}
            </div>

            {activeSchedule && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                <p className="mb-2 text-xs font-black text-navy">{formatDateLabel(activeSchedule.date)} 시간 설정</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-slate-500">시작 시간<input type="time" value={activeSchedule.startTime} onChange={event => updateActiveSchedule({ startTime: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
                  <label className="text-xs font-bold text-slate-500">종료 시간<input type="time" value={activeSchedule.endTime} onChange={event => updateActiveSchedule({ endTime: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">응답 단위(분)<input type="number" min={5} value={draft.availabilitySlotMinutes} onChange={event => setDraft({ ...draft, availabilitySlotMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-xs font-bold text-slate-500">배정 단위(분)<input type="number" min={5} value={draft.assignmentSlotMinutes} onChange={event => setDraft({ ...draft, assignmentSlotMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label></div>
            <div className="rounded-xl bg-indigo-50 p-3 text-xs font-bold text-navy">생성될 응답 슬롯: {generatedSlots.length}개</div>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm md:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">메시지 템플릿</h3>
            <p className="text-[11px] text-slate-400">사용 가능: {'{name} {link} {deadline} {interviewDate} {interviewTime} {roundName}'}</p>
            {(['availability', 'reminder', 'confirmation'] as const).map(kind => <label key={kind} className="block text-xs font-bold text-slate-500">{kind === 'availability' ? '조사 안내' : kind === 'reminder' ? '재안내' : '최종 면접 안내'}<textarea value={draft.messageTemplates[kind]} onChange={event => setDraft({ ...draft, messageTemplates: { ...draft.messageTemplates, [kind]: event.target.value } })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>)}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p role={validationError ? 'alert' : undefined} className={`text-xs font-bold ${validationError ? 'text-red-600' : 'text-emerald-600'}`}>{validationError ?? `응답 슬롯 ${generatedSlots.length}개를 저장할 수 있습니다.`}</p>
          <div className="flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-500 disabled:opacity-40">취소</button><button disabled={busy || Boolean(validationError)} onClick={submit} className="flex items-center gap-2 rounded-xl bg-navy px-6 py-2.5 text-xs font-black text-white hover:bg-gold disabled:opacity-40"><Save size={15} />{busy ? '저장 중...' : '저장'}</button></div>
        </div>
      </div>
    </div>
  );
}
