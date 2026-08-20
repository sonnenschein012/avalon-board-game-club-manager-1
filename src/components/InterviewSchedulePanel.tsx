import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Lock, RotateCcw, Trash2, Unlock } from 'lucide-react';
import type { AutoAssignmentResult } from '../domain/interviews/autoAssignment';
import { availabilityToAssignmentCandidates } from '../domain/interviews/scheduling';
import { getInterviewProgressStatus } from '../domain/interviews/interviewV3Policy';
import type { InterviewApplicantWithAccess } from '../services/interviewsService';
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

function activeApplicant(applicant: InterviewApplicantWithAccess) {
  return (applicant.lifecycle ?? 'active') === 'active' && (applicant.applicationStatus ?? 'active') === 'active';
}

function confirmationCurrent(applicant: InterviewApplicantWithAccess) {
  return Boolean(applicant.assignment && applicant.confirmationMessage.lastMarkedSentAt)
    && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0)
      === (applicant.confirmationMessage.assignmentRevision ?? 0);
}

export default function InterviewSchedulePanel({
  round,
  applicants,
  interviewers,
  changeRequests,
  draft,
  onDraftChange,
  onRunApplicantAutoAssignment,
  onApplyDraft,
  onAssign,
  onClearAssignment,
  onChangeAssignmentState,
  onResetSchedule,
}: Props) {
  const [manualApplicantId, setManualApplicantId] = useState<string | null>(null);
  const [manualChoice, setManualChoice] = useState('');
  const activeInterviewers = interviewers.filter(item => item.active);
  const openChangeRequestApplicantIds = new Set(changeRequests.filter(item => item.status === 'open').map(item => item.applicantId));
  const waiting = applicants.filter(item => activeApplicant(item) && item.access?.submittedAt && !item.assignment);
  const assigned = applicants
    .filter(item => activeApplicant(item) && item.assignment)
    .sort((left, right) => (left.assignment?.startsAt.toMillis() ?? 0) - (right.assignment?.startsAt.toMillis() ?? 0));
  const manualOptions = useMemo(() => {
    const applicant = applicants.find(item => item.id === manualApplicantId);
    if (!applicant) return [];
    const applicantSlots = new Set(availabilityToAssignmentCandidates(
      applicant.access?.availability ?? [],
      round.availabilitySlotMinutes,
      round.assignmentSlotMinutes,
    ));
    return activeInterviewers.flatMap(interviewer => availabilityToAssignmentCandidates(
      interviewer.availability,
      round.availabilitySlotMinutes,
      round.assignmentSlotMinutes,
    ).filter(slot => applicantSlots.has(slot)).map(slot => ({
      value: `${interviewer.interviewerId}|||${slot}`,
      interviewerId: interviewer.interviewerId,
      interviewerName: interviewer.displayName,
      slot,
    })));
  }, [activeInterviewers, applicants, manualApplicantId, round.assignmentSlotMinutes, round.availabilitySlotMinutes]);

  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-3xl bg-white p-4 shadow-sm"><div><h3 className="font-black text-navy">배정 대기 지원자</h3><p className="mt-1 text-xs leading-5 text-slate-400">가능시간 응답 완료 · 현재 면접시간 없음</p></div><div className="mt-4 space-y-2">{waiting.map(applicant => <article key={applicant.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-navy">{applicant.name}</p><p className="text-[10px] text-slate-400">{applicant.applicantNumber} · {applicant.access?.availability.length ?? 0}개 응답</p></div><button type="button" onClick={() => onRunApplicantAutoAssignment(applicant.id)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-2 text-[10px] font-black text-indigo-700"><Bot size={13} />자동배정</button></div><button type="button" onClick={() => { setManualApplicantId(current => current === applicant.id ? null : applicant.id); setManualChoice(''); }} className="mt-2 text-[10px] font-bold text-slate-500">수동 배정 {manualApplicantId === applicant.id ? '닫기' : '열기'}</button>{manualApplicantId === applicant.id && <div className="mt-2 space-y-2"><select value={manualChoice} onChange={event => setManualChoice(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-[10px]"><option value="">공통 가능시간 선택</option>{manualOptions.map(option => <option key={option.value} value={option.value}>{option.slot.replace('|', ' ')} · {option.interviewerName}</option>)}</select><button type="button" disabled={!manualChoice} onClick={async () => { const [interviewerId, slot] = manualChoice.split('|||'); if (interviewerId && slot && await onAssign(applicant, slot, interviewerId, true)) { setManualApplicantId(null); setManualChoice(''); } }} className="w-full rounded-xl bg-navy px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">수동 배정·잠금</button></div>}</article>)}{waiting.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">배정 대기자가 없습니다.</p>}</div></aside>

      <section className="min-w-0 rounded-3xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-navy">전체 면접 시간표</h3><p className="mt-1 text-xs text-slate-400">확정 안내가 현재 배정 revision과 일치하는 일정은 자동배정에서 보호됩니다.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{assigned.length}건</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-400"><tr><th className="rounded-l-xl p-3">날짜·시간</th><th className="p-3">지원자</th><th className="p-3">담당 면접관</th><th className="p-3">안내/진행 상태</th><th className="rounded-r-xl p-3 text-right">관리</th></tr></thead><tbody>{assigned.map(applicant => {
        const confirmed = confirmationCurrent(applicant);
        const progressStatus = getInterviewProgressStatus(applicant);
        const actionNeeded = progressStatus === 'action_needed' || openChangeRequestApplicantIds.has(applicant.id);
        const completed = progressStatus === 'completed';
        return <tr key={applicant.id} className="border-b border-slate-100"><td className="p-3 font-bold text-navy">{applicant.assignment?.slotId?.replace('|', ' ')}</td><td className="p-3"><strong>{applicant.name}</strong><span className="ml-2 text-[10px] text-slate-400">{applicant.applicantNumber}</span></td><td className="p-3">{applicant.assignment?.interviewerName}</td><td className="p-3"><div className="flex flex-wrap gap-1">{confirmed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} />안내 완료</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">시간 지정 · 안내 전</span>}{completed && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700"><CheckCircle2 size={11} />면접 완료</span>}{actionNeeded && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><AlertTriangle size={11} />조치 필요</span>}</div></td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" title={applicant.assignment?.locked ? '잠금 해제' : '잠금'} onClick={() => void onChangeAssignmentState(applicant.id, { locked: !applicant.assignment?.locked })} className="rounded-lg bg-slate-100 p-2 text-slate-600">{applicant.assignment?.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button type="button" title="배정 해제" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 현재 배정을 해제할까요? 이력은 보존됩니다.`)) void onClearAssignment(applicant.id); }} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={13} /></button><button type="button" title="일정 초기화" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 접속 기준·응답·현재 배정을 모두 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void onResetSchedule(applicant.id); }} className="rounded-lg bg-amber-50 p-2 text-amber-700"><RotateCcw size={13} /></button></div></td></tr>;
      })}</tbody></table>{assigned.length === 0 && <p className="py-10 text-center text-sm text-slate-400">배정된 면접이 없습니다.</p>}</div></section>
    </div>
    {draft && <AutoAssignmentPanel round={round} applicants={applicants} interviewers={interviewers} draft={draft} onRun={() => undefined} onDraftChange={onDraftChange} onApply={onApplyDraft} />}
  </div>;
}

export { activeApplicant, confirmationCurrent };
