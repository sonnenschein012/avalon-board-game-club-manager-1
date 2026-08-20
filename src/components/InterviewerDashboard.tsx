import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, RotateCcw, Users } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { InterviewChangeRequest, InterviewOverallRating, InterviewRound, InterviewRoundInterviewer } from '../types';
import type { InterviewApplicantWithAccess } from '../services/interviewsService';
import InterviewWorkspaceModal from './InterviewWorkspaceModal';

interface Props {
  interviewers: InterviewRoundInterviewer[];
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  changeRequests: InterviewChangeRequest[];
  onComplete: (applicantId: string, note: {
    generalNotes?: string;
    answers?: Record<string, string>;
    overallRating: InterviewOverallRating | null;
  }) => Promise<boolean>;
  onActionNeeded: (applicantId: string, reason?: string) => Promise<boolean>;
  onRestoreScheduled: (applicantId: string) => Promise<boolean>;
  onResetSchedule: (applicantId: string) => Promise<boolean>;
  onResolveRequest: (requestId: string, status: 'resolved' | 'dismissed') => Promise<void>;
}

function isOperationalApplicant(applicant: InterviewApplicantWithAccess) {
  return (applicant.lifecycle ?? 'active') === 'active'
    && (applicant.applicationStatus ?? 'active') === 'active'
    && Boolean(applicant.assignment);
}

function assignmentTime(applicant: InterviewApplicantWithAccess) {
  return applicant.assignment?.startsAt.toMillis() ?? Number.MAX_SAFE_INTEGER;
}

export default function InterviewerDashboard({
  round,
  interviewers,
  applicants,
  changeRequests,
  onComplete,
  onActionNeeded,
  onRestoreScheduled,
  onResetSchedule,
  onResolveRequest,
}: Props) {
  const activeInterviewers = interviewers.filter(item => item.active);
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase() ?? '';
  const mine = activeInterviewers.find(item => item.email?.trim().toLowerCase() === currentEmail) ?? null;
  const [mineOnly, setMineOnly] = useState(false);
  const [workspaceApplicant, setWorkspaceApplicant] = useState<InterviewApplicantWithAccess | null>(null);
  const openRequestByApplicant = useMemo(() => new Map(
    changeRequests.filter(item => item.status === 'open').map(item => [item.applicantId, item]),
  ), [changeRequests]);

  const operational = useMemo(() => applicants.filter(isOperationalApplicant), [applicants]);
  const completedCount = operational.filter(item => (
    item.interviewStatus ?? (item.assignment?.status === 'completed' ? 'completed' : 'scheduled')
  ) === 'completed').length;
  const actionNeeded = operational
    .filter(item => item.interviewStatus === 'action_needed' || openRequestByApplicant.has(item.id))
    .filter(item => !mineOnly || item.assignment?.interviewerId === mine?.interviewerId)
    .sort((left, right) => assignmentTime(left) - assignmentTime(right));
  const actionIds = new Set(actionNeeded.map(item => item.id));
  const scheduled = operational
    .filter(item => !actionIds.has(item.id) && item.interviewStatus !== 'completed' && item.assignment?.status !== 'completed')
    .filter(item => !mineOnly || item.assignment?.interviewerId === mine?.interviewerId)
    .sort((left, right) => assignmentTime(left) - assignmentTime(right));
  const workspaceInterviewer = workspaceApplicant
    ? activeInterviewers.find(item => item.interviewerId === workspaceApplicant.assignment?.interviewerId) ?? null
    : null;

  return <div className="space-y-4">
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-navy">면접 진행</h3><p className="mt-1 text-xs text-slate-400">모든 면접관의 예정 면접을 시간순으로 보여줍니다. 완료자는 선발 탭으로 이동합니다.</p></div>{mine && <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-navy"><input type="checkbox" checked={mineOnly} onChange={event => setMineOnly(event.target.checked)} />내 면접만 · {mine.displayName}</label>}</section>
    <div className="grid gap-3 sm:grid-cols-3"><Metric icon={CalendarClock} label="예정" value={scheduled.length} /><Metric icon={AlertTriangle} label="조치 필요" value={actionNeeded.length} tone="amber" /><Metric icon={CheckCircle2} label="완료" value={completedCount} tone="green" /></div>

    {actionNeeded.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h3 className="flex items-center gap-2 font-black text-amber-900"><AlertTriangle size={17} />조치 필요</h3><p className="mt-1 text-xs text-amber-700">불참, 일정 재조율, 공개 페이지의 변경 요청을 정상 예정 목록과 분리했습니다.</p><div className="mt-4 space-y-2">{actionNeeded.map(applicant => {
      const request = openRequestByApplicant.get(applicant.id);
      return <article key={applicant.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><button type="button" onClick={() => setWorkspaceApplicant(applicant)} className="text-left"><p className="font-black text-navy">{applicant.name} <span className="text-xs font-medium text-slate-400">{applicant.applicantNumber}</span></p><p className="mt-1 text-xs text-slate-500">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.assignment?.interviewerName} · {applicant.phone}</p><p className="mt-2 text-xs font-bold text-amber-700">{request?.reason || applicant.actionNeededReason || '운영진 확인 필요'}</p></button><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setWorkspaceApplicant(applicant)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy"><FileText size={14} />기록 열기</button>{request && <button type="button" onClick={() => void onResolveRequest(request.id, 'dismissed')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">요청 닫기</button>}<button type="button" onClick={() => void onRestoreScheduled(applicant.id)} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">예정으로 복귀</button><button type="button" onClick={() => { if (window.confirm(`${applicant.name} 지원자의 접속 기준·가능시간·현재 배정을 초기화할까요? 기존 기록과 배정 이력은 보존됩니다.`)) void onResetSchedule(applicant.id); }} className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white"><RotateCcw size={14} />일정 초기화</button></div></div></article>;
    })}</div></section>}

    <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="font-black text-navy">예정 면접 · 시간순</h3><div className="mt-3 space-y-2">{scheduled.map(applicant => <article key={applicant.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between"><button type="button" onClick={() => setWorkspaceApplicant(applicant)} className="min-w-0 text-left"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-navy">{applicant.name}</p><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">예정</span>{applicant.overallRating && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">종합평가 입력됨</span>}</div><p className="mt-1 text-xs text-slate-500">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.assignment?.interviewerName} · {applicant.phone}</p></button><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setWorkspaceApplicant(applicant)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy"><FileText size={14} />면접 열기</button><button type="button" onClick={() => { const reason = window.prompt('조치가 필요한 이유를 적어주세요. (선택)', '') ?? null; if (reason != null) void onActionNeeded(applicant.id, reason); }} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">조치 필요</button><button type="button" disabled={!applicant.overallRating} title={applicant.overallRating ? '저장된 종합평가와 함께 완료합니다.' : '면접 화면에서 종합평가를 먼저 입력해주세요.'} onClick={() => { if (applicant.overallRating && window.confirm(`${applicant.name} 지원자의 면접을 완료할까요?`)) void onComplete(applicant.id, { overallRating: applicant.overallRating }); }} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={14} />완료</button></div></article>)}{scheduled.length === 0 && <p className="py-10 text-center text-sm text-slate-400">예정된 면접이 없습니다.</p>}</div></section>

    <InterviewWorkspaceModal applicant={workspaceApplicant} round={round} interviewer={workspaceInterviewer} onClose={() => setWorkspaceApplicant(null)} onComplete={onComplete} onActionNeeded={onActionNeeded} />
  </div>;
}

function Metric({ icon: Icon, label, value, tone = 'default' }: { icon: typeof Users; label: string; value: number; tone?: 'default' | 'amber' | 'green' }) {
  const style = tone === 'amber' ? 'bg-amber-50 text-amber-800' : tone === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-navy';
  return <div className={`rounded-2xl p-4 shadow-sm ${style}`}><Icon size={16} className="text-gold" /><p className="mt-3 text-[10px] font-bold opacity-60">{label}</p><p className="text-2xl font-black">{value}</p></div>;
}

export { isOperationalApplicant };
