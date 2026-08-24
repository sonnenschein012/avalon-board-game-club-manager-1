import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Lock, RotateCcw, Trash2, Unlock } from 'lucide-react';
import type { AutoAssignmentProposal, AutoAssignmentResult } from '../domain/interviews/autoAssignment';
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
  selected: string;
  marker: string;
}

const INTERVIEWER_THEMES: InterviewerTheme[] = [
  { selected: 'ring-2 ring-slate-400', marker: 'bg-slate-500' },
  { selected: 'ring-2 ring-indigo-400', marker: 'bg-indigo-500' },
  { selected: 'ring-2 ring-sky-400', marker: 'bg-sky-500' },
  { selected: 'ring-2 ring-teal-400', marker: 'bg-teal-500' },
  { selected: 'ring-2 ring-violet-400', marker: 'bg-violet-500' },
];

function activeApplicant(applicant: InterviewApplicantWithAccess) {
  return canAppearInSchedule(applicant);
}

function confirmationCurrent(applicant: InterviewApplicantWithAccess) {
  return Boolean(applicant.assignment && applicant.confirmationMessage.lastMarkedSentAt)
    && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0)
      === (applicant.confirmationMessage.assignmentRevision ?? 0);
}

function scheduleDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T00:00:00.000Z`));
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

type ScheduleEntry =
  | { kind: 'assigned'; applicant: InterviewApplicantWithAccess }
  | { kind: 'draft'; proposal: AutoAssignmentProposal };

interface ScheduleCardActions {
  locked: boolean;
  onToggleLock: () => void;
  onClear: () => void;
  onReset: () => void;
}

function ScheduleCard({ entry, actionNeeded, selected, onSelect, actions }: { entry: ScheduleEntry; actionNeeded?: boolean; selected?: boolean; onSelect?: () => void; actions?: ScheduleCardActions }) {
  const applicant = entry.kind === 'assigned' ? entry.applicant : null;
  const assignment = applicant?.assignment;
  const proposal = entry.kind === 'draft' ? entry.proposal : null;
  const interviewerId = assignment?.interviewerId ?? proposal?.interviewerId ?? 'unassigned';
  const interviewerName = assignment?.interviewerName ?? proposal?.interviewerName ?? '면접관 미지정';
  const theme = interviewerTheme(interviewerId);
  const content = <><div className="flex min-w-0 items-start gap-2"><span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${theme.marker}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black leading-4 text-navy">{applicant?.name ?? proposal?.applicantName}</span>{applicant?.applicantNumber && <span className="block truncate text-[9px] font-medium leading-3 text-slate-400">{applicant.applicantNumber}</span>}</span>{assignment?.locked && <Lock aria-label="잠긴 배정" size={12} className="mt-0.5 shrink-0 text-slate-500" />}</div><div className="mt-1.5 flex min-w-0 items-center gap-1.5 pl-3"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.marker}`} /><span className="truncate text-[9px] font-bold text-slate-500">{interviewerName}</span></div>{applicant && <StatusBadges applicant={applicant} actionNeeded={Boolean(actionNeeded)} />}</>;
  if (proposal) return <div aria-label={`${proposal.applicantName} 검토안`} className="w-full rounded-xl border border-white/70 bg-white/50 px-2.5 py-2 shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-md opacity-70">{content}</div>;
  return <div className={`relative ${selected ? 'z-30' : ''}`}><button type="button" onClick={onSelect} className={`w-full rounded-xl border border-white bg-white/95 px-2.5 py-2 text-left shadow-[0_2px_10px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_6px_16px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${selected ? theme.selected : ''}`}>{content}</button>{selected && actions && <div className="absolute left-0 top-full z-40 mt-2 flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur"><button type="button" onClick={event => { event.stopPropagation(); actions.onToggleLock(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-700 transition hover:bg-slate-100">{actions.locked ? <Unlock size={12} /> : <Lock size={12} />}{actions.locked ? '잠금 해제' : '잠금'}</button><button type="button" onClick={event => { event.stopPropagation(); actions.onClear(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black text-red-600 transition hover:bg-red-50"><Trash2 size={12} />배정 해제</button><button type="button" onClick={event => { event.stopPropagation(); actions.onReset(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black text-amber-700 transition hover:bg-amber-50"><RotateCcw size={12} />일정 초기화</button></div>}</div>;
}

function WeeklySchedule({ round, assigned, draft, actionNeededIds, onClearAssignment, onChangeAssignmentState, onResetSchedule }: { round: InterviewRound; assigned: InterviewApplicantWithAccess[]; draft: AutoAssignmentResult | null; actionNeededIds: Set<string>; onClearAssignment: Props['onClearAssignment']; onChangeAssignmentState: Props['onChangeAssignmentState']; onResetSchedule: Props['onResetSchedule'] }) {
  const [datePage, setDatePage] = useState(0);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const draftProposals = useMemo(() => {
    if (!draft) return [];
    const assignmentByApplicantId = new Map(assigned.map(applicant => [applicant.id, applicant.assignment]));
    return draft.proposals.filter(proposal => {
      const current = assignmentByApplicantId.get(proposal.applicantId);
      return !current || current.slotId !== proposal.slotId || current.interviewerId !== proposal.interviewerId;
    });
  }, [assigned, draft]);
  const scheduleDates = useMemo(() => [...new Set([
    ...round.allowedSlots.map(slot => parseSlotId(slot)?.date),
    ...assigned.map(applicant => applicant.assignment?.slotId ? parseSlotId(applicant.assignment.slotId)?.date : undefined),
    ...draftProposals.map(proposal => parseSlotId(proposal.slotId)?.date),
  ].filter((date): date is string => Boolean(date)))].sort(), [assigned, draftProposals, round.allowedSlots]);
  const pageCount = Math.max(1, Math.ceil(scheduleDates.length / 5));
  const activeDatePage = Math.min(datePage, pageCount - 1);
  const visibleDates = useMemo(() => scheduleDates.slice(activeDatePage * 5, activeDatePage * 5 + 5), [activeDatePage, scheduleDates]);
  const visibleDateSet = useMemo(() => new Set(visibleDates), [visibleDates]);
  const scheduleSlots = useMemo(() => {
    const slots = new Set(round.allowedSlots.filter(slot => {
      const parsed = parseSlotId(slot);
      return parsed && visibleDateSet.has(parsed.date);
    }));
    assigned.forEach(applicant => {
      const slot = applicant.assignment?.slotId;
      const parsed = slot ? parseSlotId(slot) : null;
      if (slot && parsed && visibleDateSet.has(parsed.date)) slots.add(slot);
    });
    draftProposals.forEach(proposal => {
      const parsed = parseSlotId(proposal.slotId);
      if (parsed && visibleDateSet.has(parsed.date)) slots.add(proposal.slotId);
    });
    return slots;
  }, [assigned, draftProposals, round.allowedSlots, visibleDateSet]);
  const times = useMemo(() => [...new Set([...scheduleSlots].map(slot => parseSlotId(slot)?.time).filter((time): time is string => Boolean(time)))].sort(), [scheduleSlots]);
  const scheduleEntriesBySlot = useMemo(() => {
    const next = new Map<string, ScheduleEntry[]>();
    assigned.forEach(applicant => {
      const slot = applicant.assignment?.slotId;
      if (!slot || !scheduleSlots.has(slot)) return;
      next.set(slot, [...(next.get(slot) ?? []), { kind: 'assigned', applicant }]);
    });
    draftProposals.forEach(proposal => {
      if (!scheduleSlots.has(proposal.slotId)) return;
      next.set(proposal.slotId, [...(next.get(proposal.slotId) ?? []), { kind: 'draft', proposal }]);
    });
    next.forEach(items => items.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'assigned' ? -1 : 1;
      const leftName = left.kind === 'assigned' ? left.applicant.name : left.proposal.applicantName;
      const rightName = right.kind === 'assigned' ? right.applicant.name : right.proposal.applicantName;
      return leftName.localeCompare(rightName, 'ko-KR');
    }));
    return next;
  }, [assigned, draftProposals, scheduleSlots]);
  const visibleAssignmentCount = [...scheduleEntriesBySlot.values()].flat().filter(entry => entry.kind === 'assigned').length;
  const visibleDraftCount = [...scheduleEntriesBySlot.values()].flat().filter(entry => entry.kind === 'draft').length;
  const gridStyle = { gridTemplateColumns: `76px repeat(${Math.max(visibleDates.length, 1)}, minmax(168px, 1fr))` };
  const pageStart = activeDatePage * 5 + 1;
  const pageEnd = activeDatePage * 5 + visibleDates.length;
  const selectApplicant = (applicantId: string) => setSelectedApplicantId(current => current === applicantId ? null : applicantId);

  return <div className="hidden lg:block">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="font-black text-navy">주간 면접 시간표</h3><p className="mt-1 text-xs text-slate-400">면접 일정이 있는 날짜만 5개씩 표시합니다. 반투명 카드는 아직 확정되지 않은 검토안입니다.</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">확정 {visibleAssignmentCount} · 검토 {visibleDraftCount}</span>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-2">
      <button type="button" disabled={activeDatePage === 0} onClick={() => setDatePage(activeDatePage - 1)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={15} />이전 면접일</button>
      <p className="inline-flex items-center gap-2 text-sm font-black text-navy"><CalendarDays size={16} className="text-gold" />{scheduleDates.length ? `면접일 ${pageStart}–${pageEnd} / ${scheduleDates.length}` : '면접 일정 없음'}</p>
      <button type="button" disabled={activeDatePage >= pageCount - 1} onClick={() => setDatePage(activeDatePage + 1)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">다음 면접일<ChevronRight size={15} /></button>
    </div>
    <div className="mt-3 max-h-[calc(100vh-19rem)] min-h-[480px] overflow-auto rounded-2xl border border-slate-200">
      <div style={{ minWidth: `${76 + Math.max(visibleDates.length, 1) * 168}px` }}>
        <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur" style={gridStyle}>
          <div className="sticky left-0 z-30 bg-white p-3 text-[10px] font-black text-slate-400">시간</div>
          {visibleDates.map(date => <div key={date} className="border-l border-slate-100 p-3 text-center text-[11px] font-black text-navy">{scheduleDateLabel(date)}</div>)}
        </div>
        {times.map(time => <div key={time} className="grid border-b border-slate-100 last:border-b-0" style={gridStyle}>
          <div className="sticky left-0 z-10 flex min-h-[104px] items-start bg-white px-3 pt-3 text-xs font-black text-slate-500">{time}</div>
          {visibleDates.map(date => {
            const slotId = `${date}|${time}`;
            const slotIsAvailable = scheduleSlots.has(slotId);
            const entries = scheduleEntriesBySlot.get(slotId) ?? [];
            return <div key={slotId} className={`min-h-[104px] border-l border-slate-100 p-2 ${slotIsAvailable ? 'bg-white' : 'bg-slate-50/70'}`}>
              {slotIsAvailable && <div className="space-y-2">
                {entries.slice(0, 3).map(entry => entry.kind === 'assigned' ? <ScheduleCard key={`assigned-${entry.applicant.id}`} entry={entry} actionNeeded={actionNeededIds.has(entry.applicant.id)} selected={selectedApplicantId === entry.applicant.id} onSelect={() => selectApplicant(entry.applicant.id)} actions={{ locked: Boolean(entry.applicant.assignment?.locked), onToggleLock: () => void onChangeAssignmentState(entry.applicant.id, { locked: !entry.applicant.assignment?.locked }), onClear: () => { if (window.confirm(`${entry.applicant.name} 지원자의 현재 배정을 해제할까요? 이력은 보존됩니다.`)) void onClearAssignment(entry.applicant.id); }, onReset: () => { if (window.confirm(`${entry.applicant.name} 지원자의 접속 기준·응답·현재 배정을 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void onResetSchedule(entry.applicant.id); } }} /> : <ScheduleCard key={`draft-${entry.proposal.applicantId}`} entry={entry} />)}
                {entries.length > 3 && <p className="px-2 py-1 text-[10px] font-bold text-slate-400">+ {entries.length - 3}개 더 있음</p>}
              </div>}
            </div>;
          })}
        </div>)}
        {times.length === 0 && <div className="p-12 text-center text-sm text-slate-400">설정된 면접 일정이 없습니다.</div>}
      </div>
    </div>
  </div>;
}

export default function InterviewSchedulePanel({ round, applicants, interviewers, changeRequests, draft, onDraftChange, onRunApplicantAutoAssignment, onApplyDraft, onAssign, onClearAssignment, onChangeAssignmentState, onResetSchedule }: Props) {
  const [manualApplicantId, setManualApplicantId] = useState<string | null>(null);
  const [manualChoice, setManualChoice] = useState('');
  const [autoAssigningApplicantId, setAutoAssigningApplicantId] = useState<string | null>(null);
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
  const runApplicantAutoAssignment = (applicantId: string) => {
    if (autoAssigningApplicantId) return;
    setAutoAssigningApplicantId(applicantId);
    onRunApplicantAutoAssignment(applicantId);
    window.setTimeout(() => setAutoAssigningApplicantId(null), 280);
  };

  return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="rounded-3xl bg-white p-4 shadow-sm"><div><h3 className="font-black text-navy">배정 대기 지원자</h3><p className="mt-1 text-xs leading-5 text-slate-400">가능시간 응답 완료 · 현재 면접시간 없음</p></div><div className="mt-4 space-y-2">{waiting.map(applicant => { const autoAssigning = autoAssigningApplicantId === applicant.id; return <article key={applicant.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-navy">{applicant.name}</p><p className="text-[10px] text-slate-400">{applicant.applicantNumber} · {applicant.access?.availability.length ?? 0}개 응답</p></div><button type="button" disabled={autoAssigningApplicantId !== null} onClick={() => runApplicantAutoAssignment(applicant.id)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black shadow-sm transition-colors duration-150 disabled:cursor-wait disabled:opacity-75 ${autoAssigning ? 'border-gold bg-gold/20 text-navy shadow-[0_0_0_3px_rgba(212,175,55,0.16)]' : 'border-gold/50 bg-navy text-white hover:border-gold hover:bg-slate-800'}`}><Bot size={14} className={autoAssigning ? 'text-navy' : 'text-gold'} />자동배정</button></div><button type="button" onClick={() => { setManualApplicantId(current => current === applicant.id ? null : applicant.id); setManualChoice(''); }} className="mt-2 text-[10px] font-bold text-slate-500">수동 배정 {manualApplicantId === applicant.id ? '닫기' : '열기'}</button>{manualApplicantId === applicant.id && <div className="mt-2 space-y-2"><select value={manualChoice} onChange={event => setManualChoice(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-[10px]"><option value="">공통 가능시간 선택</option>{manualOptions.map(option => <option key={option.value} value={option.value}>{option.slot.replace('|', ' ')} · {option.interviewerName}</option>)}</select><button type="button" disabled={!manualChoice} onClick={async () => { const [interviewerId, slot] = manualChoice.split('|||'); if (interviewerId && slot && await onAssign(applicant, slot, interviewerId, true)) { setManualApplicantId(null); setManualChoice(''); } }} className="w-full rounded-xl bg-navy px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">수동 배정·잠금</button></div>}</article>; })}{waiting.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">배정 대기자가 없습니다.</p>}</div></aside><section className="min-w-0 space-y-4 rounded-3xl bg-white p-4 shadow-sm">{draft && <AutoAssignmentPanel compact round={round} applicants={applicants} interviewers={interviewers} draft={draft} onRun={() => undefined} onDraftChange={onDraftChange} onApply={onApplyDraft} />}<WeeklySchedule round={round} assigned={assigned} draft={draft} actionNeededIds={openChangeRequestApplicantIds} onClearAssignment={onClearAssignment} onChangeAssignmentState={onChangeAssignmentState} onResetSchedule={onResetSchedule} /><MobileScheduleList assigned={assigned} actionNeededIds={openChangeRequestApplicantIds} onClearAssignment={onClearAssignment} onChangeAssignmentState={onChangeAssignmentState} onResetSchedule={onResetSchedule} /></section></div></div>;
}

function MobileScheduleList({ assigned, actionNeededIds, onClearAssignment, onChangeAssignmentState, onResetSchedule }: { assigned: InterviewApplicantWithAccess[]; actionNeededIds: Set<string>; onClearAssignment: Props['onClearAssignment']; onChangeAssignmentState: Props['onChangeAssignmentState']; onResetSchedule: Props['onResetSchedule'] }) {
  return <div className="lg:hidden"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-navy">전체 면접 시간표</h3><p className="mt-1 text-xs text-slate-400">확정 안내가 현재 배정 revision과 일치하는 일정은 자동배정에서 보호됩니다.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{assigned.length}건</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-400"><tr><th className="rounded-l-xl p-3">날짜·시간</th><th className="p-3">지원자</th><th className="p-3">담당 면접관</th><th className="p-3">안내/진행 상태</th><th className="rounded-r-xl p-3 text-right">관리</th></tr></thead><tbody>{assigned.map(applicant => { const confirmed = confirmationCurrent(applicant); const progressStatus = getInterviewProgressStatus(applicant); const actionNeeded = progressStatus === 'action_needed' || actionNeededIds.has(applicant.id); const completed = progressStatus === 'completed'; return <tr key={applicant.id} className="border-b border-slate-100"><td className="p-3 font-bold text-navy">{applicant.assignment?.slotId?.replace('|', ' ')}</td><td className="p-3"><strong>{applicant.name}</strong><span className="ml-2 text-[10px] text-slate-400">{applicant.applicantNumber}</span></td><td className="p-3">{applicant.assignment?.interviewerName}</td><td className="p-3"><div className="flex flex-wrap gap-1">{confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} />안내 완료</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">시간 지정 · 안내 전</span>}{completed && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700"><CheckCircle2 size={11} />면접 완료</span>}{actionNeeded && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><AlertTriangle size={11} />조치 필요</span>}</div></td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" title={applicant.assignment?.locked ? '잠금 해제' : '잠금'} onClick={() => void onChangeAssignmentState(applicant.id, { locked: !applicant.assignment?.locked })} className="rounded-lg bg-slate-100 p-2 text-slate-600">{applicant.assignment?.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" title="배정 해제" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 현재 배정을 해제할까요? 이력은 보존됩니다.`)) void onClearAssignment(applicant.id); }} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={13} /></button><button type="button" title="일정 초기화" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 접속 기준·응답·현재 배정을 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void onResetSchedule(applicant.id); }} className="rounded-lg bg-amber-50 p-2 text-amber-700"><RotateCcw size={13} /></button></div></td></tr>; })}</tbody></table>{assigned.length === 0 && <p className="py-10 text-center text-sm text-slate-400">배정된 면접이 없습니다.</p>}</div></div>;
}

export { activeApplicant, confirmationCurrent };
