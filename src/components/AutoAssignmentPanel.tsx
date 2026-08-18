import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Play, RotateCcw } from 'lucide-react';
import type { AutoAssignmentResult } from '../domain/interviews/autoAssignment';
import type { InterviewApplicantWithAccess } from '../services/interviewsService';
import type { InterviewRound, InterviewRoundInterviewer } from '../types';
import { availabilityToAssignmentCandidates, parseSlotId } from '../domain/interviews/scheduling';

interface Props {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  interviewers: InterviewRoundInterviewer[];
  draft: AutoAssignmentResult | null;
  onRun: (mode: 'all' | 'unassigned') => void;
  onDraftChange: (draft: AutoAssignmentResult | null) => void;
  onApply: () => Promise<boolean>;
  applying?: boolean;
}

const reasonLabel = {
  no_availability: '지원자가 가능시간을 제출하지 않음',
  no_interviewer_overlap: '지원자와 면접관의 겹치는 가능시간 없음',
  all_candidates_occupied: '가능한 시간이 다른 배정으로 모두 사용됨',
  excluded_state: '완료·불참·취소 또는 보관 상태',
};

function slotLabel(slotId: string) {
  const parsed = parseSlotId(slotId);
  return parsed ? `${parsed.date} ${parsed.time}` : slotId;
}

export default function AutoAssignmentPanel({ round, applicants, interviewers, draft, onRun, onDraftChange, onApply, applying = false }: Props) {
  const applicantsById = useMemo(() => new Map(applicants.map(item => [item.id, item])), [applicants]);
  const activeInterviewers = interviewers.filter(item => item.active);
  const updateProposal = (applicantId: string, interviewerId: string, slotId: string) => {
    if (!draft) return;
    const interviewer = activeInterviewers.find(item => item.interviewerId === interviewerId);
    if (!interviewer) return;
    onDraftChange({ ...draft, proposals: draft.proposals.map(proposal => proposal.applicantId === applicantId ? {
      ...proposal, interviewerId, interviewerName: interviewer.displayName, slotId, preserved: false,
    } : proposal) });
  };
  if (!draft) return <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><div><h3 className="font-black text-navy">자동 배정 초안 만들기</h3><p className="mt-1 text-sm text-slate-500">지원자와 면접관의 가능시간을 모두 만족하는 조합만 계산합니다. 결과는 바로 저장되지 않습니다.</p></div><div className="flex flex-wrap gap-2"><button disabled={activeInterviewers.length === 0} onClick={() => onRun('all')} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Play size={14} />전체 자동 배정</button><button disabled={activeInterviewers.length === 0} onClick={() => onRun('unassigned')} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-black text-navy disabled:opacity-40"><RotateCcw size={14} />미배정자만 배정</button></div>{activeInterviewers.length === 0 && <p className="text-xs font-bold text-red-600">면접관과 가능시간을 먼저 등록해주세요.</p>}</section>;
  return <section className="space-y-5 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-navy">자동 배정 검토</h3><p className="mt-1 text-xs text-slate-500">전체 {draft.totalApplicants}명 · 배정 {draft.assignedCount}명 · 실패 {draft.failures.length}명</p></div><div className="flex gap-2"><button onClick={() => onDraftChange(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500">초안 버리기</button><button disabled={applying} onClick={() => void onApply()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">{applying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}검토안 확정</button></div></div>
    <div className="grid gap-2 sm:grid-cols-3">{activeInterviewers.map(interviewer => <div key={interviewer.id} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{interviewer.displayName}</p><p className="text-xl font-black text-navy">{draft.interviewerLoads[interviewer.interviewerId] ?? 0}명</p></div>)}</div>
    <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-400"><tr><th className="p-3">지원자</th><th className="p-3">면접관</th><th className="p-3">시간</th><th className="p-3">보호 상태</th></tr></thead><tbody>{draft.proposals.map(proposal => {
      const applicant = applicantsById.get(proposal.applicantId);
      const selectedInterviewer = activeInterviewers.find(item => item.interviewerId === proposal.interviewerId);
      const applicantSlots = new Set(availabilityToAssignmentCandidates(applicant?.access?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes));
      const interviewerSlots = new Set(availabilityToAssignmentCandidates(selectedInterviewer?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes));
      const slots = [...applicantSlots].filter(slot => interviewerSlots.has(slot)).sort();
      return <tr key={proposal.applicantId} className="border-t border-slate-100"><td className="p-3 font-bold text-navy">{proposal.applicantName}</td><td className="p-3"><select disabled={proposal.locked} value={proposal.interviewerId} onChange={event => { const next = activeInterviewers.find(item => item.interviewerId === event.target.value); const nextSlots = next ? availabilityToAssignmentCandidates(next.availability, round.availabilitySlotMinutes, round.assignmentSlotMinutes).filter(slot => applicantSlots.has(slot)) : []; updateProposal(proposal.applicantId, event.target.value, nextSlots[0] ?? proposal.slotId); }} className="rounded-lg border border-slate-200 px-2 py-1.5"><option value="">면접관</option>{activeInterviewers.map(item => <option key={item.id} value={item.interviewerId}>{item.displayName}</option>)}</select></td><td className="p-3"><select disabled={proposal.locked} value={proposal.slotId} onChange={event => updateProposal(proposal.applicantId, proposal.interviewerId, event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5">{slots.map(slot => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}</select></td><td className="p-3">{proposal.locked ? <span className="inline-flex items-center gap-1 font-bold text-amber-700"><Lock size={12} />잠금</span> : proposal.preserved ? '기존 일정 유지' : '자동 초안'}</td></tr>;
    })}</tbody></table></div>
    {draft.failures.length > 0 && <div className="rounded-2xl bg-red-50 p-4"><h4 className="flex items-center gap-2 text-xs font-black text-red-700"><AlertTriangle size={14} />배정 실패</h4><div className="mt-2 space-y-1 text-xs text-red-700">{draft.failures.map(item => <p key={item.applicantId}><strong>{item.applicantName}</strong> — {reasonLabel[item.reason]}</p>)}</div></div>}
  </section>;
}
