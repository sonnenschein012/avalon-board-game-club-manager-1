import { useState } from 'react';
import { Award, Check, CheckCircle2, Loader2, MessageSquareText, RotateCcw, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useInterviewNoteLogic } from '../hooks/useInterviewNoteLogic';
import type { InterviewApplicantWithAccess } from '../types';
import type { InterviewOverallRating, InterviewRound, InterviewSelectionStatus } from '../types';

export interface SelectionDetailModalProps {
  applicant: InterviewApplicantWithAccess | null;
  round: InterviewRound;
  onClose: () => void;
  /** The parent is responsible for enforcing administrator permissions. */
  onUpdateSelectionStatus: (applicantId: string, status: InterviewSelectionStatus) => Promise<boolean>;
  onUpdateOverallRating: (applicantId: string, rating: InterviewOverallRating) => Promise<boolean>;
  onReopenCompletedInterview: (applicantId: string) => Promise<boolean>;
}

const RATINGS: Record<InterviewOverallRating, { label: string; className: string }> = {
  strongly_recommend: { label: '적극 추천', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  recommend: { label: '추천', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  neutral: { label: '중립', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  not_recommend: { label: '비추천', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  strongly_not_recommend: { label: '적극 비추천', className: 'border-red-200 bg-red-50 text-red-800' },
};

const SELECTIONS: Record<InterviewSelectionStatus, string> = { pending: '미결정', selected: '선발', rejected: '미선발' };

export default function SelectionDetailModal({ applicant, round, onClose, onUpdateSelectionStatus, onUpdateOverallRating, onReopenCompletedInterview }: SelectionDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [ratingUpdating, setRatingUpdating] = useState(false);
  const [reopening, setReopening] = useState(false);
  // Passing null keeps this modal read-only while still using the existing note subscription path.
  const note = useInterviewNoteLogic(round.id, applicant?.id ?? null, null);
  if (!applicant) return null;
  const noteRating = (note as unknown as { overallRating?: InterviewOverallRating | null }).overallRating;
  const rating = applicant.overallRating ?? noteRating ?? null;
  const selection = applicant.selectionStatus ?? 'pending';
  const interviewAssignment = applicant.assignment ?? applicant.previousAssignment;

  const updateStatus = async (next: InterviewSelectionStatus) => {
    if (next === selection || updating) return;
    setUpdating(true);
    try {
      if (await onUpdateSelectionStatus(applicant.id, next)) toast.success(`${applicant.name} 지원자를 ${SELECTIONS[next]} 처리했습니다.`);
    } catch { toast.error('선발 상태를 저장하지 못했습니다.'); } finally { setUpdating(false); }
  };

  const updateRating = async (next: InterviewOverallRating) => {
    if (next === rating || ratingUpdating) return;
    setRatingUpdating(true);
    try {
      if (await onUpdateOverallRating(applicant.id, next)) toast.success(`${applicant.name} 지원자의 종합평가를 수정했습니다.`);
    } catch { toast.error('종합평가를 수정하지 못했습니다.'); } finally { setRatingUpdating(false); }
  };

  const reopenInterview = async () => {
    if (reopening) return;
    if (!window.confirm('면접을 예정 상태로 되돌릴까요? 선발 결정은 미결정으로 바뀌고, 질문 기록·종합 노트·평가는 보존됩니다.')) return;
    setReopening(true);
    try {
      if (await onReopenCompletedInterview(applicant.id)) {
        toast.success(`${applicant.name} 지원자의 면접 완료를 취소했습니다.`);
        onClose();
      }
    } catch {
      toast.error('면접 완료를 취소하지 못했습니다.');
    } finally {
      setReopening(false);
    }
  };

  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-5">
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-navy">{applicant.name}</h2><span className="text-xs text-slate-400">{applicant.applicantNumber}</span>{rating ? <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${RATINGS[rating].className}`}>{RATINGS[rating].label}</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">평가 미입력</span>}</div><p className="mt-1 text-xs text-slate-500">담당 면접관: {interviewAssignment?.interviewerName ?? '미지정'}</p></div><button type="button" onClick={onClose} aria-label="모달 닫기" className="rounded-xl bg-slate-100 p-2 text-slate-500"><X size={18} /></button></header>
      <main className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:p-6">
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><Award size={16} className="text-gold" />면접관 종합평가</h3><p className="mt-1 text-xs text-slate-500">완료 후 정정이 필요한 경우 아래 평가를 선택하면 기록과 지원자 상태가 함께 갱신됩니다.</p><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(RATINGS).map(([value, info]) => <button key={value} type="button" disabled={ratingUpdating} onClick={() => void updateRating(value as InterviewOverallRating)} className={`rounded-xl border px-2 py-2.5 text-xs font-black disabled:opacity-50 ${rating === value ? 'border-navy bg-navy text-white' : info.className}`}>{info.label}</button>)}</div><div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs font-bold text-slate-400">종합 노트</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.generalNotes || '기록 없음'}</p></div></section>
        <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><MessageSquareText size={16} className="text-gold" />질문별 면접 기록</h3><div className="mt-4 space-y-3">{(round.interviewQuestions ?? []).map((question, index) => <div key={question.id} className="rounded-xl bg-slate-50 p-3"><p className="whitespace-pre-wrap text-xs font-black text-navy">{index + 1}. {question.text}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.answers[question.id] || '기록 없음'}</p></div>)}{!(round.interviewQuestions ?? []).length && <p className="text-sm text-slate-400">등록된 면접 질문이 없습니다.</p>}</div></section>
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"><div><p className="text-xs font-bold text-slate-500">현재 선발 상태: <span className="text-navy">{SELECTIONS[selection]}</span></p><button type="button" disabled={reopening} onClick={() => void reopenInterview()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy disabled:opacity-50">{reopening ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}면접 완료 취소</button></div><div className="flex gap-2"><DecisionButton label="미결정" active={selection === 'pending'} disabled={updating || reopening} onClick={() => void updateStatus('pending')} icon={<Check size={14} />} /><DecisionButton label="미선발" active={selection === 'rejected'} disabled={updating || reopening} onClick={() => void updateStatus('rejected')} icon={<XCircle size={14} />} /><DecisionButton label="선발" active={selection === 'selected'} disabled={updating || reopening} onClick={() => void updateStatus('selected')} icon={updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} /></div></footer>
    </div>
  </div>;
}

function DecisionButton({ label, active, disabled, onClick, icon }: { label: string; active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${active ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{icon}{label}</button>; }
