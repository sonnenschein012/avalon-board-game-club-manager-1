import { useMemo, useState } from 'react';
import { Check, FileText, Search, UserCheck } from 'lucide-react';
import type { InterviewApplicantWithAccess } from '../types';
import type { InterviewOverallRating, InterviewRound, InterviewSelectionStatus } from '../types';
import SelectionDetailModal from './SelectionDetailModal';
import { canAppearInSelection } from '../domain/interviews/interviewV3Policy';

export interface SelectionPanelProps {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  /** The parent is responsible for enforcing administrator permissions. */
  onUpdateSelectionStatus: (applicantId: string, status: InterviewSelectionStatus) => Promise<boolean>;
  onUpdateOverallRating: (applicantId: string, rating: InterviewOverallRating) => Promise<boolean>;
  onReopenCompletedInterview: (applicantId: string) => Promise<boolean>;
}

const RATINGS: Record<InterviewOverallRating, { label: string; className: string; weight: number }> = {
  strongly_recommend: { label: '적극 추천', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', weight: 5 },
  recommend: { label: '추천', className: 'border-blue-200 bg-blue-50 text-blue-800', weight: 4 },
  neutral: { label: '중립', className: 'border-slate-200 bg-slate-50 text-slate-700', weight: 3 },
  not_recommend: { label: '비추천', className: 'border-amber-200 bg-amber-50 text-amber-800', weight: 2 },
  strongly_not_recommend: { label: '적극 비추천', className: 'border-red-200 bg-red-50 text-red-800', weight: 1 },
};

const SELECTIONS: Record<InterviewSelectionStatus, { label: string; className: string }> = {
  pending: { label: '미결정', className: 'bg-amber-100 text-amber-800' },
  selected: { label: '선발', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '미선발', className: 'bg-red-100 text-red-800' },
};

function getStudentId(applicant: InterviewApplicantWithAccess): string {
  const direct = (applicant as unknown as { studentId?: unknown }).studentId;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const fields = applicant.applicationData ?? [];
  const field = fields.find(item => {
    const header = item.header.trim().toLowerCase().replace(/[\s_-]/g, '');
    return header.includes('학번') || header.includes('studentid') || header.includes('studentnumber');
  });
  return field?.value?.trim() ?? '';
}

function isCompleted(applicant: InterviewApplicantWithAccess) {
  return applicant.interviewStatus === 'completed' || applicant.assignment?.status === 'completed';
}

function isSelectionCandidate(applicant: InterviewApplicantWithAccess) {
  return canAppearInSelection(applicant) && isCompleted(applicant);
}

export default function SelectionPanel({ round, applicants, onUpdateSelectionStatus, onUpdateOverallRating, onReopenCompletedInterview }: SelectionPanelProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InterviewSelectionStatus>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | InterviewOverallRating>('all');
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const candidates = useMemo(() => applicants.filter(isSelectionCandidate), [applicants]);
  const selectedApplicant = candidates.find(applicant => applicant.id === selectedApplicantId) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return candidates
      .filter(applicant => {
        const selection = applicant.selectionStatus ?? 'pending';
        const searchable = `${applicant.applicantNumber} ${applicant.name} ${getStudentId(applicant)}`.toLowerCase();
        return (!normalized || searchable.includes(normalized))
          && (statusFilter === 'all' || selection === statusFilter)
          && (ratingFilter === 'all' || applicant.overallRating === ratingFilter);
      })
      .sort((left, right) => left.applicantNumber.localeCompare(right.applicantNumber, 'ko-KR'));
  }, [candidates, query, ratingFilter, statusFilter]);
  const counts = useMemo(() => ({
    selected: candidates.filter(item => item.selectionStatus === 'selected').length,
    rejected: candidates.filter(item => item.selectionStatus === 'rejected').length,
    pending: candidates.filter(item => !item.selectionStatus || item.selectionStatus === 'pending').length,
  }), [candidates]);

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-4">
      <Metric label="면접 완료" value={candidates.length} />
      <Metric label="선발" value={counts.selected} tone="emerald" />
      <Metric label="미선발" value={counts.rejected} tone="red" />
      <Metric label="미결정" value={counts.pending} tone="amber" />
    </div>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="지원번호, 이름, 학번 검색" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" /></div>
      <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | InterviewSelectionStatus)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">전체 상태</option><option value="pending">미결정</option><option value="selected">선발</option><option value="rejected">미선발</option></select>
      <select value={ratingFilter} onChange={event => setRatingFilter(event.target.value as 'all' | InterviewOverallRating)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">전체 평가</option>{Object.entries(RATINGS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}</select>
    </div>
    <div className="space-y-2">
      {filtered.map(applicant => <SelectionRow key={applicant.id} applicant={applicant} onOpen={() => setSelectedApplicantId(applicant.id)} onUpdateSelectionStatus={onUpdateSelectionStatus} />)}
      {!filtered.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{candidates.length ? '조건에 맞는 지원자가 없습니다.' : '면접 완료된 지원자가 없습니다.'}</div>}
    </div>
    <SelectionDetailModal applicant={selectedApplicant} round={round} onClose={() => setSelectedApplicantId(null)} onUpdateOverallRating={onUpdateOverallRating} onUpdateSelectionStatus={onUpdateSelectionStatus} onReopenCompletedInterview={onReopenCompletedInterview} />
  </div>;
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'red' | 'amber' }) {
  const colors = { slate: 'bg-white text-navy', emerald: 'bg-emerald-50 text-emerald-800', red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-800' };
  return <div className={`rounded-2xl border border-slate-100 p-4 shadow-sm ${colors[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}명</p></div>;
}

function SelectionRow({ applicant, onOpen, onUpdateSelectionStatus }: { applicant: InterviewApplicantWithAccess; onOpen: () => void; onUpdateSelectionStatus: SelectionPanelProps['onUpdateSelectionStatus'] }) {
  const selection = applicant.selectionStatus ?? 'pending';
  const rating = applicant.overallRating ? RATINGS[applicant.overallRating] : null;
  const interviewAssignment = applicant.assignment ?? applicant.previousAssignment;
  return <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
    <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><UserCheck size={18} /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-black text-navy">{applicant.name}<small className="font-medium text-slate-400">{applicant.applicantNumber}</small>{rating ? <small className={`rounded-full border px-2 py-0.5 text-[10px] ${rating.className}`}>{rating.label}</small> : <small className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">평가 미입력</small>}</span><span className="mt-1 block truncate text-xs text-slate-500">{getStudentId(applicant) || '학번 미입력'} · 담당 면접관 {interviewAssignment?.interviewerName ?? '미지정'}</span></span></button>
    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${SELECTIONS[selection].className}`}>{SELECTIONS[selection].label}</span><div className="flex gap-1 rounded-xl bg-slate-50 p-1"><StatusButton active={selection === 'pending'} label="미결정" onClick={() => void onUpdateSelectionStatus(applicant.id, 'pending')} /><StatusButton active={selection === 'rejected'} label="미선발" onClick={() => void onUpdateSelectionStatus(applicant.id, 'rejected')} /><StatusButton active={selection === 'selected'} label="선발" onClick={() => void onUpdateSelectionStatus(applicant.id, 'selected')} /></div><button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy"><FileText size={14} />기록 보기</button></div>
  </article>;
}

function StatusButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-lg px-2 py-1.5 text-xs font-bold ${active ? 'bg-navy text-white' : 'text-slate-600 hover:bg-white'}`}>{active && <Check size={12} className="mr-1 inline" />}{label}</button>; }

export { getStudentId, isSelectionCandidate };
