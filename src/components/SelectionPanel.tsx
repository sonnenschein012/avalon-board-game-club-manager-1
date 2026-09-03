import { useMemo, useState } from 'react';
import { FileText, Search, UserCheck } from 'lucide-react';
import type {
  InterviewApplicantWithAccess,
  InterviewOverallRating,
  InterviewRound,
  InterviewSelectionStatus,
} from '../types';
import { canAppearInSelection } from '../domain/interviews/interviewPolicy';
import { INTERVIEW_RATING_LABELS, OVERALL_RATINGS } from '../domain/interviews/interviewRatings';
import SelectionDetailModal from './SelectionDetailModal';
import { getSelectionDecisionButtonClass } from './selectionDecisionStyles';

export interface SelectionPanelProps {
  round: InterviewRound;
  applicants: InterviewApplicantWithAccess[];
  onUpdateSelectionStatus: (id: string, status: InterviewSelectionStatus) => Promise<boolean>;
  onUpdateOverallRating: (id: string, rating: InterviewOverallRating) => Promise<boolean>;
  onReopenCompletedInterview: (id: string) => Promise<boolean>;
}

const SELECTION_LABELS: Record<InterviewSelectionStatus, string> = {
  pending: '결정 대기',
  selected: '선발',
  rejected: '미선발',
};

export function getStudentId(applicant: InterviewApplicantWithAccess): string {
  const direct = (applicant as unknown as { studentId?: unknown }).studentId;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  return applicant.applicationData?.find(item => {
    const key = item.header.toLowerCase().replace(/[\s_-]/g, '');
    return key.includes('학번') || key.includes('studentid') || key.includes('studentnumber');
  })?.value?.trim() ?? '';
}

export default function SelectionPanel({
  round,
  applicants,
  onUpdateSelectionStatus,
  onUpdateOverallRating,
  onReopenCompletedInterview,
}: SelectionPanelProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | InterviewSelectionStatus>('pending');
  const [rating, setRating] = useState<'all' | InterviewOverallRating>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const candidates = useMemo(() => applicants.filter(canAppearInSelection), [applicants]);
  const counts = useMemo(() => ({
    pending: candidates.filter(item => !item.selectionStatus || item.selectionStatus === 'pending').length,
    selected: candidates.filter(item => item.selectionStatus === 'selected').length,
    rejected: candidates.filter(item => item.selectionStatus === 'rejected').length,
  }), [candidates]);
  const filtered = useMemo(() => {
    const searchQuery = query.trim().toLowerCase();
    return candidates.filter(item => {
      const selection = item.selectionStatus ?? 'pending';
      const searchable = `${item.applicantNumber} ${item.name} ${getStudentId(item)}`.toLowerCase();
      return searchable.includes(searchQuery)
        && (status === 'all' || selection === status)
        && (rating === 'all' || item.overallRating === rating);
    }).sort((a, b) => a.applicantNumber.localeCompare(b.applicantNumber, 'ko-KR'));
  }, [candidates, query, status, rating]);

  const cards: Array<{ key: 'all' | InterviewSelectionStatus; label: string; value: number }> = [
    { key: 'pending', label: '결정 대기', value: counts.pending },
    { key: 'selected', label: '선발', value: counts.selected },
    { key: 'rejected', label: '미선발', value: counts.rejected },
    { key: 'all', label: '전체 면접 완료', value: candidates.length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map(card => (
          <button
            key={card.key}
            onClick={() => setStatus(card.key)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${status === card.key ? 'border-navy/30 bg-navy/10 text-navy' : 'border-slate-100 bg-white text-navy hover:border-slate-200'}`}
          >
            <p className="text-xs font-bold text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-black">{card.value}명</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="지원번호, 이름, 학번 검색"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy/40"
          />
        </div>
        <select
          value={status}
          onChange={event => setStatus(event.target.value as typeof status)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="pending">결정 대기</option>
          <option value="selected">선발</option>
          <option value="rejected">미선발</option>
          <option value="all">전체 상태</option>
        </select>
        <select
          value={rating}
          onChange={event => setRating(event.target.value as typeof rating)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">전체 평가</option>
          {OVERALL_RATINGS.map(value => (
            <option key={value} value={value}>{INTERVIEW_RATING_LABELS[value]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const selection = item.selectionStatus ?? 'pending';
          const assignment = item.assignment ?? item.previousAssignment;
          return (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <button onClick={() => setOpenId(item.id)} className="flex min-w-0 items-center gap-3 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-navy">
                  <UserCheck size={18} />
                </span>
                <span>
                  <strong className="text-navy">
                    {item.name} <small className="font-medium text-slate-400">{item.applicantNumber}</small>
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {getStudentId(item) || '학번 미입력'} · {assignment?.interviewerName ?? '담당 미지정'} · {item.overallRating ? INTERVIEW_RATING_LABELS[item.overallRating] : '평가 미입력'}
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selection === 'selected' ? 'bg-emerald-50 text-emerald-700' : selection === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                  {SELECTION_LABELS[selection]}
                </span>
                <button
                  onClick={() => void onUpdateSelectionStatus(item.id, 'rejected')}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${getSelectionDecisionButtonClass(selection, 'rejected')}`}
                >
                  미선발
                </button>
                <button
                  onClick={() => void onUpdateSelectionStatus(item.id, 'selected')}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${getSelectionDecisionButtonClass(selection, 'selected')}`}
                >
                  선발
                </button>
                <button
                  onClick={() => setOpenId(item.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-navy"
                >
                  <FileText size={14} />기록 보기
                </button>
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {candidates.length ? '조건에 맞는 지원자가 없습니다.' : '면접 완료된 지원자가 없습니다.'}
          </div>
        )}
      </div>

      <SelectionDetailModal
        applicant={candidates.find(item => item.id === openId) ?? null}
        round={round}
        onClose={() => setOpenId(null)}
        onUpdateOverallRating={onUpdateOverallRating}
        onUpdateSelectionStatus={onUpdateSelectionStatus}
        onReopenCompletedInterview={onReopenCompletedInterview}
      />
    </div>
  );
}
