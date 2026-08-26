import { useEffect, useMemo, useState } from 'react';
import { X, Save, CalendarDays, Plus, Trash2 } from 'lucide-react';
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
    assignmentSlotMinutes: round?.assignmentSlotMinutes ?? 10,
    // Kept in persisted documents for backward compatibility. Whether the
    // public form is open is derived only from the configured date range.
    status: 'collecting',
    instructions: round?.instructions ?? '선택해 주신 시간 중 운영진이 면접 시간을 배정한 뒤 문자로 안내드릴 예정입니다.\n\n시간표의 칸을 누르거나 드래그하여 여러 시간을 한 번에 선택할 수 있습니다.',
    messageTemplates: round?.messageTemplates ?? {
      availability: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 아발론에 지원해 주셔서 감사합니다!\n전화 면접 일정 조율을 위해 {deadline}까지 아래 링크에서 가능한 시간을 선택 후 저장해 주세요.\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 다시 안내드리겠습니다.',
      reminder: '{name} 님, 아직 면접 가능 시간이 선택되지 않아 다시 한번 안내드립니다.\n\n{deadline}까지 아래 링크에서 가능한 시간을 모두 선택해 주세요!\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 안내드리겠습니다.',
      confirmation: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 예정된 면접 일정을 다시 한번 안내드립니다.\n\n📅 {interviewDate} {interviewTime}\n☎️ 담당 면접관 {interviewerName} · {interviewerPhone}\n\n위 번호로 전화드릴 예정이니 편하게 받아주세요. 곧 뵙겠습니다!',
      reschedule: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 요청하신 일정 조정에 따라 면접 일정이 변경되어 안내드립니다.\n\n기존: {oldInterviewDate} {oldInterviewTime}\n변경: {interviewDate} {interviewTime}\n☎️ 담당 면접관 {interviewerName} · {interviewerPhone}\n\n위 번호로 전화드릴 예정입니다. 확인 부탁드립니다!',
    },
    interviewQuestions: round?.interviewQuestions ?? [],
    allowedSlots: round?.allowedSlots ?? [],
    daySchedules: round?.daySchedules ?? [],
  };
}

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

function schedulesFromDraft(draft: InterviewRoundDraft): InterviewDaySchedule[] {
  if (draft.daySchedules.length > 0) return [...draft.daySchedules].sort((left, right) => left.date.localeCompare(right.date));
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

interface InterviewRoundFormModalProps {
  open: boolean;
  round?: InterviewRound | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: InterviewRoundDraft) => Promise<boolean | void>;
  onDelete?: () => void;
}

export default function InterviewRoundFormModal({ open, round, saving = false, onClose, onSave, onDelete }: InterviewRoundFormModalProps) {
  const [draft, setDraft] = useState<InterviewRoundDraft>(() => roundToDraft(round));
  const [daySchedules, setDaySchedules] = useState<InterviewDaySchedule[]>(() => schedulesFromDraft(roundToDraft(round)));
  const [internalSaving, setInternalSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const nextDraft = roundToDraft(round);
      const nextSchedules = schedulesFromDraft(nextDraft);
      setDraft(nextDraft);
      setDaySchedules(nextSchedules);
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
    return null;
  }, [draft.name]);

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
        daySchedules: sortedSchedules,
        interviewQuestions: draft.interviewQuestions
          .map(question => ({ ...question, text: question.text.trim() }))
          .filter(question => question.text.length > 0),
      });
      if (saved !== false) onClose();
    } finally {
      setInternalSaving(false);
    }
  };

  const busy = saving || internalSaving;

  if (!round) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-navy p-2 text-white"><CalendarDays size={18} /></span>
              <div><h2 className="font-black text-navy">새 면접 회차</h2><p className="text-[10px] uppercase text-slate-400">Interview round</p></div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <div className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-500">회차명<input autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="2026-2 아발론 신입부원 면접" /></label>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600">회차를 만든 뒤 지원자 화면에서 면접 일정을 추가하고, 그 일정마다 조사 기간과 면접 가능일을 설정할 수 있습니다.</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p role={validationError ? 'alert' : undefined} className={`text-xs font-bold ${validationError ? 'text-red-600' : 'text-emerald-600'}`}>{validationError ?? '회차명만 입력하면 생성할 수 있습니다.'}</p>
            <div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 disabled:opacity-40">취소</button><button type="button" disabled={busy || Boolean(validationError)} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-black text-white disabled:opacity-40"><Save size={15} />{busy ? '생성 중...' : '회차 생성'}</button></div>
          </div>
        </div>
      </div>
    );
  }

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
          <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm md:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">기본 설정</h3>
            <label className="block text-xs font-bold text-slate-500">회차명<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="2026-2 아발론 5기 신입부원 면접" /></label>
            <label className="block text-xs font-bold text-slate-500">지원자 안내문<textarea value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold leading-relaxed text-slate-600">조사 기간과 면접 가능일은 일정 탭의 각 면접 일정에서 관리합니다.</p>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-black uppercase tracking-wider text-navy">면접 질문</h3><p className="mt-1 text-[11px] text-slate-400">면접관 대시보드에서 지원자별 답변을 바로 기록할 수 있습니다.</p></div><button type="button" onClick={() => setDraft({ ...draft, interviewQuestions: [...draft.interviewQuestions, { id: crypto.randomUUID(), text: '' }] })} className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-navy"><Plus size={14} />질문 추가</button></div>
            <div className="space-y-2">{draft.interviewQuestions.map((question, index) => <div key={question.id} className="flex items-start gap-2"><span className="mt-2.5 w-6 shrink-0 text-center text-xs font-black text-slate-400">{index + 1}</span><textarea value={question.text} onChange={event => setDraft({ ...draft, interviewQuestions: draft.interviewQuestions.map(item => item.id === question.id ? { ...item, text: event.target.value } : item) })} className="min-h-16 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="면접 질문을 입력하세요." /><button type="button" aria-label="질문 삭제" onClick={() => setDraft({ ...draft, interviewQuestions: draft.interviewQuestions.filter(item => item.id !== question.id) })} className="mt-1 rounded-lg p-2 text-red-500"><Trash2 size={14} /></button></div>)}</div>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm md:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">메시지 템플릿</h3>
            <p className="text-[11px] text-slate-400">사용 가능: {'{name} {link} {deadline} {interviewDate} {interviewTime} {oldInterviewDate} {oldInterviewTime} {interviewerName} {interviewerPhone} {roundName}'}</p>
            {(['availability', 'reminder', 'confirmation', 'reschedule'] as const).map(kind => <label key={kind} className="block text-xs font-bold text-slate-500">{kind === 'availability' ? '조사 안내' : kind === 'reminder' ? '재안내' : kind === 'confirmation' ? '최종 면접 안내' : '일정 변경 안내'}<textarea value={draft.messageTemplates[kind]} onChange={event => setDraft({ ...draft, messageTemplates: { ...draft.messageTemplates, [kind]: event.target.value } })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>)}
          </section>

          {onDelete && <section className="flex flex-col gap-4 rounded-2xl border border-red-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:col-span-2"><div><h3 className="text-xs font-black uppercase tracking-wider text-red-700">회차 삭제</h3><p className="mt-1 text-xs leading-5 text-slate-500">지원자, 개인 링크, 일정, 면접관, 평가와 이력을 영구 삭제합니다. 등록된 동아리원은 유지됩니다.</p></div><button type="button" onClick={onDelete} disabled={busy} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 size={15} />회차 삭제</button></section>}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p role={validationError ? 'alert' : undefined} className={`text-xs font-bold ${validationError ? 'text-red-600' : 'text-emerald-600'}`}>{validationError ?? '회차 공통 설정을 저장할 수 있습니다.'}</p>
          <div className="flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-500 disabled:opacity-40">취소</button><button disabled={busy || Boolean(validationError)} onClick={submit} className="flex items-center gap-2 rounded-xl bg-navy px-6 py-2.5 text-xs font-black text-white hover:bg-gold disabled:opacity-40"><Save size={15} />{busy ? '저장 중...' : '저장'}</button></div>
        </div>
      </div>
    </div>
  );
}
