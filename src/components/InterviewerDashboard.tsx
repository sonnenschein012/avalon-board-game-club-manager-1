import { useState } from 'react';
import { CalendarClock, Check, Clock3, FileText, UserRound, Users } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { InterviewChangeRequest, InterviewRound, InterviewRoundInterviewer } from '../types';
import type { InterviewApplicantWithAccess } from '../services/interviewsService';
import { candidatesForVacatedSlot, recommendReassignment } from '../domain/interviews/reassignment';
import InterviewWorkspaceModal from './InterviewWorkspaceModal';

interface Props {
  interviewers: InterviewRoundInterviewer[];
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  changeRequests: InterviewChangeRequest[];
  onStateChange: (applicantId: string, status: 'completed' | 'no_show' | 'needs_reschedule') => Promise<boolean>;
  onResolveRequest: (requestId: string, status: 'resolved' | 'dismissed') => Promise<void>;
  onReassign: (applicant: InterviewApplicantWithAccess, slotId: string, interviewerId: string) => Promise<boolean>;
}

export default function InterviewerDashboard({ round, interviewers, applicants, changeRequests, onStateChange, onResolveRequest, onReassign }: Props) {
  const active = interviewers.filter(item => item.active);
  const mine = active.find(item => item.email && item.email === auth.currentUser?.email?.trim().toLowerCase());
  const [selectedId, setSelectedId] = useState(mine?.interviewerId ?? active[0]?.interviewerId ?? '');
  const [workspaceApplicant, setWorkspaceApplicant] = useState<InterviewApplicantWithAccess | null>(null);
  const selected = active.find(item => item.interviewerId === selectedId) ?? active[0] ?? null;
  const scheduled = applicants.filter(item => item.assignment?.interviewerId === selected?.interviewerId).sort((left, right) => (left.assignment?.startsAt.toMillis() ?? 0) - (right.assignment?.startsAt.toMillis() ?? 0));
  const [now] = useState(() => Date.now());
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
  const today = scheduled.filter(item => item.assignment?.slotId?.startsWith(todayKey));
  const upcoming = scheduled.filter(item => (item.assignment?.startsAt.toMillis() ?? 0) >= now);
  const selectedIds = new Set(scheduled.map(item => item.id));
  const requests = changeRequests.filter(item => item.status === 'open' && selectedIds.has(item.applicantId));
  const occupied = new Set(applicants.flatMap(item => item.assignment?.slotId && !['no_show', 'cancelled', 'needs_reschedule'].includes(item.assignment.status) ? [`${item.assignment.interviewerId}|${item.assignment.slotId}`] : []));
  if (!selected) return <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-400">면접관을 먼저 등록해주세요.</div>;
  return <div className="space-y-4"><div className="rounded-2xl bg-white p-4 shadow-sm"><div><h3 className="font-black text-navy">면접관 대시보드</h3><p className="text-xs text-slate-400">로그인 이메일이 연결되어 있으면 본인이 자동 선택됩니다.</p></div><select value={selected.interviewerId} onChange={event => setSelectedId(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold md:hidden">{active.map(item => <option key={item.id} value={item.interviewerId}>{item.displayName}</option>)}</select><div className="mt-3 hidden grid-cols-2 gap-2 md:grid lg:grid-cols-3 xl:grid-cols-4">{active.map(item => <button key={item.id} onClick={() => setSelectedId(item.interviewerId)} className={`min-h-14 w-full rounded-xl border px-4 py-2.5 text-left transition ${selected.interviewerId === item.interviewerId ? 'border-navy bg-navy text-white shadow-sm' : 'border-slate-200 bg-white text-navy hover:border-gold hover:bg-amber-50'}`}><strong className="block truncate text-sm">{item.displayName}</strong><span className={`text-[10px] ${selected.interviewerId === item.interviewerId ? 'text-white/60' : 'text-slate-400'}`}>{applicants.filter(applicant => applicant.assignment?.interviewerId === item.interviewerId).length}명 배정</span></button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-4"><Metric icon={Users} label="전체 배정" value={scheduled.length} /><Metric icon={CalendarClock} label="오늘" value={today.length} /><Metric icon={Clock3} label="향후" value={upcoming.length} /><Metric icon={UserRound} label="변경 요청" value={requests.length} /></div>
    {requests.length > 0 && <section className="rounded-3xl bg-amber-50 p-5"><h3 className="font-black text-amber-800">변경 요청</h3><div className="mt-3 space-y-2">{requests.map(request => {
      const applicant = applicants.find(item => item.id === request.applicantId);
      const recommendations = applicant ? recommendReassignment({ id: applicant.id, availability: applicant.access?.availability ?? [], current: applicant.assignment?.slotId ? { slotId: applicant.assignment.slotId, interviewerId: applicant.assignment.interviewerId } : null }, interviewers.filter(item => item.active).map(item => ({ id: item.interviewerId, name: item.displayName, availability: item.availability })), new Set([...occupied].filter(key => !key.endsWith(`|${applicant.assignment?.slotId ?? ''}`))), round.availabilitySlotMinutes, round.assignmentSlotMinutes).slice(0, 3) : [];
      return <div key={request.id} className="rounded-xl bg-white p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{request.applicantName}</strong> · {request.reason || '일정 변경 요청'}</span><div className="flex gap-1"><button onClick={() => void onResolveRequest(request.id, 'dismissed')} className="rounded-lg px-2 py-1 text-slate-500">닫기</button><button onClick={() => void onResolveRequest(request.id, 'resolved')} className="rounded-lg bg-amber-600 px-2 py-1 font-bold text-white">처리 완료</button></div></div>{recommendations.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{recommendations.map(item => <button key={`${item.interviewerId}|${item.slotId}`} onClick={async () => { if (!applicant || !window.confirm(`${item.slotId.replace('|', ' ')} · ${item.interviewerName} 면접관으로 변경할까요?`)) return; if (await onReassign(applicant, item.slotId, item.interviewerId)) await onResolveRequest(request.id, 'resolved'); }} className="rounded-lg bg-indigo-50 px-2 py-1.5 font-bold text-navy">추천 {item.slotId.replace('|', ' ')} · {item.interviewerName}</button>)}</div>}</div>;
    })}</div></section>}
    <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="font-black text-navy">시간순 일정</h3><div className="mt-3 space-y-2">{scheduled.map(applicant => {
      const vacatedCandidates = applicant.assignment?.slotId && ['no_show', 'cancelled', 'needs_reschedule'].includes(applicant.assignment.status) ? candidatesForVacatedSlot(applicant.assignment.slotId, applicant.assignment.interviewerId, applicants.map(item => ({ id: item.id, availability: item.access?.availability ?? [], current: item.assignment?.slotId ? { slotId: item.assignment.slotId, interviewerId: item.assignment.interviewerId } : null })), round.availabilitySlotMinutes, round.assignmentSlotMinutes).map(id => applicants.find(item => item.id === id)?.name).filter(Boolean) : [];
      const status = assignmentStatusView(applicant.assignment?.status);
      return <article key={applicant.id} className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${status.border}`}><button onClick={() => setWorkspaceApplicant(applicant)} className="block w-full p-4 text-left active:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-navy">{applicant.name}</p><p className="mt-1 text-xs text-slate-500">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.phone}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${status.badge}`}>{status.label}</span></div><p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-indigo-700"><FileText size={13} />지원서 답변 확인 · 면접 노트 작성</p></button><div className="border-t border-slate-100 bg-slate-50/70 p-3"><p className="mb-2 text-[10px] font-black text-slate-400">면접 결과 상태</p><div className="grid grid-cols-3 gap-2"><StateButton active={applicant.assignment?.status === 'completed'} tone="green" label="완료" onClick={() => confirmStateChange(applicant.name, '완료', () => onStateChange(applicant.id, 'completed'))} /><StateButton active={applicant.assignment?.status === 'no_show'} tone="red" label="불참" onClick={() => confirmStateChange(applicant.name, '불참', () => onStateChange(applicant.id, 'no_show'))} /><StateButton active={applicant.assignment?.status === 'needs_reschedule'} tone="amber" label="재배정 필요" onClick={() => confirmStateChange(applicant.name, '재배정 필요', () => onStateChange(applicant.id, 'needs_reschedule'))} /></div></div>{vacatedCandidates.length > 0 && <p className="border-t border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-navy"><strong>빈 시간 후보:</strong> {vacatedCandidates.join(', ')} · 추천만 제공되며 자동 변경하지 않습니다.</p>}</article>;
    })}{scheduled.length === 0 && <p className="py-10 text-center text-sm text-slate-400">배정된 일정이 없습니다.</p>}</div></section>
    <InterviewWorkspaceModal applicant={workspaceApplicant} round={round} interviewer={selected} onClose={() => setWorkspaceApplicant(null)} />
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) { return <div className="rounded-2xl bg-white p-4 shadow-sm"><Icon size={16} className="text-gold" /><p className="mt-3 text-[10px] font-bold text-slate-400">{label}</p><p className="text-2xl font-black text-navy">{value}</p></div>; }

function assignmentStatusView(status?: string) {
  if (status === 'completed') return { label: '면접 완료', badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-300' };
  if (status === 'no_show') return { label: '불참', badge: 'bg-red-100 text-red-800', border: 'border-red-300' };
  if (status === 'needs_reschedule' || status === 'change_requested') return { label: '재배정 필요', badge: 'bg-amber-100 text-amber-800', border: 'border-amber-300' };
  if (status === 'confirmed') return { label: '확정 안내 완료', badge: 'bg-indigo-100 text-indigo-800', border: 'border-indigo-200' };
  if (status === 'cancelled') return { label: '취소', badge: 'bg-slate-200 text-slate-700', border: 'border-slate-300' };
  return { label: '면접 예정', badge: 'bg-blue-100 text-blue-800', border: 'border-blue-200' };
}

function confirmStateChange(name: string, label: string, action: () => Promise<boolean>) {
  if (window.confirm(`${name} 지원자의 상태를 “${label}”로 변경할까요?`)) void action();
}

function StateButton({ active, tone, label, onClick }: { active: boolean; tone: 'green' | 'red' | 'amber'; label: string; onClick: () => void }) {
  const activeStyle = tone === 'green' ? 'border-emerald-600 bg-emerald-600 text-white' : tone === 'red' ? 'border-red-600 bg-red-600 text-white' : 'border-amber-500 bg-amber-500 text-white';
  return <button onClick={onClick} className={`min-h-11 rounded-xl border px-2 py-2 text-[11px] font-black transition ${active ? activeStyle : 'border-slate-200 bg-white text-slate-500'}`}>{active && tone === 'green' && <Check size={12} className="mr-1 inline" />}{label}</button>;
}
