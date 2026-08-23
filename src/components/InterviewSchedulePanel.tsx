import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Lock, RotateCcw, Trash2, Unlock, UserRound } from 'lucide-react';
import type { AutoAssignmentResult } from '../domain/interviews/autoAssignment';
import { availabilityToAssignmentCandidates, parseSlotId } from '../domain/interviews/scheduling';
import { canAppearInSchedule, getInterviewProgressStatus } from '../domain/interviews/interviewV3Policy';
import type { InterviewApplicantWithAccess } from '../types';
import type { InterviewAssignment, InterviewChangeRequest, InterviewRound, InterviewRoundInterviewer } from '../types';
import AutoAssignmentPanel from './AutoAssignmentPanel';

interface Props {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  interviewers: InterviewRoundInterviewer[];
  changeRequests: InterviewChangeRequest[];
  draft: AutoAssignmentResult | null;
  onDraftChange: (draft: AutoAssignmentResult | null) => void;
  onRunApplicantAutoAssignment: (applicantId: string) => void;
  onApplyDraft: () => Promise<boolean>;
  onAssign: (applicant: InterviewApplicantWithAccess, slot: string, interviewerId: string, lock?: boolean) => Promise<boolean>;
  onClearAssignment: (applicantId: string) => Promise<void>;
  onChangeAssignmentState: (applicantId: string, patch: Partial<Pick<InterviewAssignment, 'locked' | 'status'>>) => Promise<boolean>;
  onResetSchedule: (applicantId: string) => Promise<boolean>;
}

interface InterviewerTheme {
  card: string;
  selected: string;
  marker: string;
}

const INTERVIEWER_THEMES: InterviewerTheme[] = [
  { card: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300', selected: 'ring-2 ring-slate-400', marker: 'bg-slate-500' },
  { card: 'border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-300', selected: 'ring-2 ring-indigo-400', marker: 'bg-indigo-500' },
  { card: 'border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-300', selected: 'ring-2 ring-sky-400', marker: 'bg-sky-500' },
  { card: 'border-teal-200 bg-teal-50 text-teal-950 hover:border-teal-300', selected: 'ring-2 ring-teal-400', marker: 'bg-teal-500' },
  { card: 'border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-300', selected: 'ring-2 ring-violet-400', marker: 'bg-violet-500' },
];

function activeApplicant(applicant: InterviewApplicantWithAccess) {
  return canAppearInSchedule(applicant);
}

function confirmationCurrent(applicant: InterviewApplicantWithAccess) {
  return Boolean(applicant.assignment && applicant.confirmationMessage.lastMarkedSentAt)
    && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0)
      === (applicant.confirmationMessage.assignmentRevision ?? 0);
}

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromDate(date);
}

function weekStartFor(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return addDays(dateKey, -(date.getUTCDay() + 6) % 7);
}

function initialWeekStart(round: InterviewRound, assigned: InterviewApplicantWithAccess[]) {
  const firstSlot = [...round.allowedSlots].sort()[0]
    ?? assigned.map(applicant => applicant.assignment?.slotId).filter((slot): slot is string => Boolean(slot)).sort()[0];
  const date = firstSlot ? parseSlotId(firstSlot)?.date : null;
  return weekStartFor(date ?? dateKeyFromDate(new Date()));
}

function weekDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T00:00:00.000Z`));
}

function weekRangeLabel(startDate: string) {
  const format = (dateKey: string) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T00:00:00.000Z`));
  return `${format(startDate)} – ${format(addDays(startDate, 6))}`;
}

function interviewerTheme(interviewerId: string) {
  let hash = 0;
  for (const character of interviewerId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return INTERVIEWER_THEMES[Math.abs(hash) % INTERVIEWER_THEMES.length] ?? INTERVIEWER_THEMES[0]!;
}

function StatusBadges({ applicant, actionNeeded }: { applicant: InterviewApplicantWithAccess; actionNeeded: boolean }) {
  const confirmed = confirmationCurrent(applicant);
  const progressStatus = getInterviewProgressStatus(applicant);
  return <div className="mt-1.5 flex flex-wrap gap-1">{confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700"><CheckCircle2 size={10} />안내</span> : <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">안내 전</span>}{progressStatus === 'completed' && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-700">완료</span>}{actionNeeded && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700"><AlertTriangle size={10} />조치</span>}</div>;
}

function ScheduleCard({ applicant, actionNeeded, selected, onSelect }: { applicant: InterviewApplicantWithAccess; actionNeeded: boolean; selected: boolean; onSelect: () => void }) {
  const theme = interviewerTheme(applicant.assignment?.interviewerId ?? 'unassigned');
  return <button type="button" onClick={onSelect} className={`w-full rounded-lg border px-2 py-1.5 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${theme.card} ${selected ? theme.selected : ''}`}><div className="flex items-start gap-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${theme.marker}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black">{applicant.name}</span><span className="block truncate text-[9px] font-medium opacity-70">{applicant.assignment?.interviewerName ?? '면접관 미지정'}</span></span>{applicant.assignment?.locked ? <Lock aria-label="잠긴 배정" size={12} className="mt-0.5 shrink-0 text-slate-600" /> : <Unlock aria-label="잠기지 않은 배정" size={12} className="mt-0.5 shrink-0 text-slate-400" />}</div><StatusBadges applicant={applicant} actionNeeded={actionNeeded} /></button>;
}

function SelectedScheduleDetails({ applicant, slotApplicants, selectedSlotId, actionNeededIds, onSelectApplicant, onClearAssignment, onChangeAssignmentState, onResetSchedule }: { applicant: InterviewApplicantWithAccess | null; slotApplicants: InterviewApplicantWithAccess[]; selectedSlotId: string | null; actionNeededIds: Set<string>; onSelectApplicant: (applicantId: string) => void; onClearAssignment: Props['onClearAssignment']; onChangeAssignmentState: Props['onChangeAssignmentState']; onResetSchedule: Props['onResetSchedule'] }) {
  if (!applicant && !selectedSlotId) return <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">시간표 카드를 선택하면 배정 상세와 관리 메뉴가 이곳에 표시됩니다.</div>;
  if (!applicant) return <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-navy">{selectedSlotId?.replace('|', ' ')} 배정</p><div className="mt-3 grid gap-2 xl:grid-cols-2">{slotApplicants.map(item => <button key={item.id} type="button" onClick={() => onSelectApplicant(item.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-navy hover:border-indigo-300"><span>{item.name}</span><span className="ml-2 font-medium text-slate-400">{item.assignment?.interviewerName}</span></button>)}</div></div>;
  const theme = interviewerTheme(applicant.assignment?.interviewerId ?? 'unassigned');
  return <div className={`mt-4 rounded-2xl border p-4 ${theme.card}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black"><UserRound size={15} />{applicant.name}<span className="text-[11px] font-medium opacity-60">{applicant.applicantNumber}</span>{applicant.assignment?.locked ? <Lock size={14} aria-label="잠긴 배정" /> : <Unlock size={14} aria-label="잠기지 않은 배정" />}</p><p className="mt-1 text-xs opacity-75">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.assignment?.interviewerName}</p><StatusBadges applicant={applicant} actionNeeded={actionNeededIds.has(applicant.id)} /></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void onChangeAssignmentState(applicant.id, { locked: !applicant.assignment?.locked })} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">{applicant.assignment?.locked ? <Unlock size={13} /> : <Lock size={13} />}{applicant.assignment?.locked ? '잠금 해제' : '잠금'}</button><button type="button" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 현재 배정을 해제할까요? 이력은 보존됩니다.`)) void onClearAssignment(applicant.id); }} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"><Trash2 size={13} />배정 해제</button><button type="button" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 접속 기준·응답·현재 배정을 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void onResetSchedule(applicant.id); }} className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"><RotateCcw size={13} />일정 초기화</button></div></div></div>;
}

function WeeklySchedule({ round, assigned, actionNeededIds, onClearAssignment, onChangeAssignmentState, onResetSchedule }: { round: InterviewRound; assigned: InterviewApplicantWithAccess[]; actionNeededIds: Set<string>; onClearAssignment: Props['onClearAssignment']; onChangeAssignmentState: Props['onChangeAssignmentState']; onResetSchedule: Props['onResetSchedule'] }) {
  const [weekStart, setWeekStart] = useState(() => initialWeekStart(round, assigned));
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekDateSet = useMemo(() => new Set(weekDays), [weekDays]);
  const scheduleSlots = useMemo(() => {
    const slots = new Set(round.allowedSlots.filter(slot => {
      const parsed = parseSlotId(slot);
      return parsed && weekDateSet.has(parsed.date);
    }));
    assigned.forEach(applicant => {
      const slot = applicant.assignment?.slotId;
      const parsed = slot ? parseSlotId(slot) : null;
      if (slot && parsed && weekDateSet.has(parsed.date)) slots.add(slot);
    });
    return slots;
  }, [assigned, round.allowedSlots, weekDateSet]);
  const times = useMemo(() => [...new Set([...scheduleSlots].map(slot => parseSlotId(slot)?.time).filter((time): time is string => Boolean(time)))].sort(), [scheduleSlots]);
  const applicantsBySlot = useMemo(() => {
    const next = new Map<string, InterviewApplicantWithAccess[]>();
    assigned.forEach(applicant => {
      const slot = applicant.assignment?.slotId;
      if (!slot || !scheduleSlots.has(slot)) return;
      next.set(slot, [...(next.get(slot) ?? []), applicant]);
    });
    next.forEach(items => items.sort((left, right) => left.name.localeCompare(right.name, 'ko-KR')));
    return next;
  }, [assigned, scheduleSlots]);
  const selectedApplicant = assigned.find(item => item.id === selectedApplicantId) ?? null;
  const selectedSlotApplicants = selectedSlotId ? applicantsBySlot.get(selectedSlotId) ?? [] : [];
  const weekAssignmentCount = [...applicantsBySlot.values()].reduce((count, items) => count + items.length, 0);
  const selectApplicant = (applicantId: string) => { const applicant = assigned.find(item => item.id === applicantId); setSelectedApplicantId(applicantId); setSelectedSlotId(applicant?.assignment?.slotId ?? null); };

  return <div className="hidden lg:block"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-navy">주간 면접 시간표</h3><p className="mt-1 text-xs text-slate-400">면접관별 카드 색상으로 담당자를 구분하고, 카드 선택 후 배정을 관리합니다.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">이번 주 {weekAssignmentCount}건</span></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-2"><button type="button" onClick={() => setWeekStart(current => addDays(current, -7))} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-slate-600 hover:bg-white"><ChevronLeft size={15} />이전 주</button><p className="inline-flex items-center gap-2 text-sm font-black text-navy"><CalendarDays size={16} className="text-gold" />{weekRangeLabel(weekStart)}</p><button type="button" onClick={() => setWeekStart(current => addDays(current, 7))} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-slate-600 hover:bg-white">다음 주<ChevronRight size={15} /></button></div><div className="mt-3 max-h-[calc(100vh-19rem)] min-h-[480px] overflow-auto rounded-2xl border border-slate-200"><div className="min-w-[980px]"><div className="sticky top-0 z-20 grid grid-cols-[76px_repeat(7,minmax(128px,1fr))] border-b border-slate-200 bg-white"><div className="sticky left-0 z-30 bg-white p-3 text-[10px] font-black text-slate-400">시간</div>{weekDays.map(date => <div key={date} className="border-l border-slate-100 p-3 text-center text-[11px] font-black text-navy">{weekDateLabel(date)}</div>)}</div>{times.map(time => <div key={time} className="grid grid-cols-[76px_repeat(7,minmax(128px,1fr))] border-b border-slate-100 last:border-b-0"><div className="sticky left-0 z-10 flex min-h-[88px] items-start bg-white px-3 pt-3 text-xs font-black text-slate-500">{time}</div>{weekDays.map(date => { const slotId = `${date}|${time}`; const slotIsAvailable = scheduleSlots.has(slotId); const items = applicantsBySlot.get(slotId) ?? []; return <div key={slotId} className={`min-h-[88px] border-l border-slate-100 p-1.5 ${slotIsAvailable ? 'bg-white' : 'bg-slate-50/70'}`}>{slotIsAvailable && <div className="space-y-1.5">{items.slice(0, 3).map(applicant => <ScheduleCard key={applicant.id} applicant={applicant} actionNeeded={actionNeededIds.has(applicant.id)} selected={selectedApplicantId === applicant.id} onSelect={() => selectApplicant(applicant.id)} />)}{items.length > 3 && <button type="button" onClick={() => { setSelectedApplicantId(null); setSelectedSlotId(slotId); }} className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-left text-[10px] font-black text-slate-600 hover:bg-slate-200">+ {items.length - 3}명 더 보기</button>}</div>}</div>; })}</div>)}{times.length === 0 && <div className="p-12 text-center text-sm text-slate-400">이 주에 설정된 면접 시간이 없습니다.</div>}</div></div><SelectedScheduleDetails applicant={selectedApplicant} slotApplicants={selectedSlotApplicants} selectedSlotId={selectedSlotId} actionNeededIds={actionNeededIds} onSelectApplicant={selectApplicant} onClearAssignment={onClearAssignment} onChangeAssignmentState={onChangeAssignmentState} onResetSchedule={onResetSchedule} /></div>;
}

export default function InterviewSchedulePanel({ round, applicants, interviewers, changeRequests, draft, onDraftChange, onRunApplicantAutoAssignment, onApplyDraft, onAssign, onClearAssignment, onChangeAssignmentState, onResetSchedule }: Props) {
  const [manualApplicantId, setManualApplicantId] = useState<string | null>(null);
  const [manualChoice, setManualChoice] = useState('');
  const activeInterviewers = interviewers.filter(item => item.active);
  const openChangeRequestApplicantIds = new Set(changeRequests.filter(item => item.status === 'open').map(item => item.applicantId));
  const waiting = applicants.filter(item => activeApplicant(item) && item.access?.submittedAt && !item.assignment);
  const assigned = applicants.filter(item => activeApplicant(item) && item.assignment).sort((left, right) => (left.assignment?.startsAt.toMillis() ?? 0) - (right.assignment?.startsAt.toMillis() ?? 0));
  const manualOptions = useMemo(() => {
    const applicant = applicants.find(item => item.id === manualApplicantId);
    if (!applicant) return [];
    const applicantSlots = new Set(availabilityToAssignmentCandidates(applicant.access?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes));
    return activeInterviewers.flatMap(interviewer => availabilityToAssignmentCandidates(interviewer.availability, round.availabilitySlotMinutes, round.assignmentSlotMinutes).filter(slot => applicantSlots.has(slot)).map(slot => ({ value: `${interviewer.interviewerId}|||${slot}`, interviewerId: interviewer.interviewerId, interviewerName: interviewer.displayName, slot })));
  }, [activeInterviewers, applicants, manualApplicantId, round.assignmentSlotMinutes, round.availabilitySlotMinutes]);

  return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="rounded-3xl bg-white p-4 shadow-sm"><div><h3 className="font-black text-navy">배정 대기 지원자</h3><p className="mt-1 text-xs leading-5 text-slate-400">가능시간 응답 완료 · 현재 면접시간 없음</p></div><div className="mt-4 space-y-2">{waiting.map(applicant => <article key={applicant.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-navy">{applicant.name}</p><p className="text-[10px] text-slate-400">{applicant.applicantNumber} · {applicant.access?.availability.length ?? 0}개 응답</p></div><button type="button" onClick={() => onRunApplicantAutoAssignment(applicant.id)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-2 text-[10px] font-black text-indigo-700"><Bot size={13} />자동배정</button></div><button type="button" onClick={() => { setManualApplicantId(current => current === applicant.id ? null : applicant.id); setManualChoice(''); }} className="mt-2 text-[10px] font-bold text-slate-500">수동 배정 {manualApplicantId === applicant.id ? '닫기' : '열기'}</button>{manualApplicantId === applicant.id && <div className="mt-2 space-y-2"><select value={manualChoice} onChange={event => setManualChoice(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-[10px]"><option value="">공통 가능시간 선택</option>{manualOptions.map(option => <option key={option.value} value={option.value}>{option.slot.replace('|', ' ')} · {option.interviewerName}</option>)}</select><button type="button" disabled={!manualChoice} onClick={async () => { const [interviewerId, slot] = manualChoice.split('|||'); if (interviewerId && slot && await onAssign(applicant, slot, interviewerId, true)) { setManualApplicantId(null); setManualChoice(''); } }} className="w-full rounded-xl bg-navy px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">수동 배정·잠금</button></div>}</article>)}{waiting.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">배정 대기자가 없습니다.</p>}</div></aside><section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm"><WeeklySchedule round={round} assigned={assigned} actionNeededIds={openChangeRequestApplicantIds} onClearAssignment={onClearAssignment} onChangeAssignmentState={onChangeAssignmentState} onResetSchedule={onResetSchedule} /><MobileScheduleList assigned={assigned} actionNeededIds={openChangeRequestApplicantIds} onClearAssignment={onClearAssignment} onChangeAssignmentState={onChangeAssignmentState} onResetSchedule={onResetSchedule} /></section></div>{draft && <AutoAssignmentPanel round={round} applicants={applicants} interviewers={interviewers} draft={draft} onRun={() => undefined} onDraftChange={onDraftChange} onApply={onApplyDraft} />}</div>;
}

function MobileScheduleList({ assigned, actionNeededIds, onClearAssignment, onChangeAssignmentState, onResetSchedule }: { assigned: InterviewApplicantWithAccess[]; actionNeededIds: Set<string>; onClearAssignment: Props['onClearAssignment']; onChangeAssignmentState: Props['onChangeAssignmentState']; onResetSchedule: Props['onResetSchedule'] }) {
  return <div className="lg:hidden"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-navy">전체 면접 시간표</h3><p className="mt-1 text-xs text-slate-400">확정 안내가 현재 배정 revision과 일치하는 일정은 자동배정에서 보호됩니다.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{assigned.length}건</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-400"><tr><th className="rounded-l-xl p-3">날짜·시간</th><th className="p-3">지원자</th><th className="p-3">담당 면접관</th><th className="p-3">안내/진행 상태</th><th className="rounded-r-xl p-3 text-right">관리</th></tr></thead><tbody>{assigned.map(applicant => { const confirmed = confirmationCurrent(applicant); const progressStatus = getInterviewProgressStatus(applicant); const actionNeeded = progressStatus === 'action_needed' || actionNeededIds.has(applicant.id); const completed = progressStatus === 'completed'; return <tr key={applicant.id} className="border-b border-slate-100"><td className="p-3 font-bold text-navy">{applicant.assignment?.slotId?.replace('|', ' ')}</td><td className="p-3"><strong>{applicant.name}</strong><span className="ml-2 text-[10px] text-slate-400">{applicant.applicantNumber}</span></td><td className="p-3">{applicant.assignment?.interviewerName}</td><td className="p-3"><div className="flex flex-wrap gap-1">{confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} />안내 완료</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">시간 지정 · 안내 전</span>}{completed && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700"><CheckCircle2 size={11} />면접 완료</span>}{actionNeeded && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><AlertTriangle size={11} />조치 필요</span>}</div></td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" title={applicant.assignment?.locked ? '잠금 해제' : '잠금'} onClick={() => void onChangeAssignmentState(applicant.id, { locked: !applicant.assignment?.locked })} className="rounded-lg bg-slate-100 p-2 text-slate-600">{applicant.assignment?.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" title="배정 해제" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 현재 배정을 해제할까요? 이력은 보존됩니다.`)) void onClearAssignment(applicant.id); }} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={13} /></button><button type="button" title="일정 초기화" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 접속 기준·응답·현재 배정을 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void onResetSchedule(applicant.id); }} className="rounded-lg bg-amber-50 p-2 text-amber-700"><RotateCcw size={13} /></button></div></td></tr>; })}</tbody></table>{assigned.length === 0 && <p className="py-10 text-center text-sm text-slate-400">배정된 면접이 없습니다.</p>}</div></div>;
}

export { activeApplicant, confirmationCurrent };
