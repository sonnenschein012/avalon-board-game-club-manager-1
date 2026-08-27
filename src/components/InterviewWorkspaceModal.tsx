import { useEffect, useState } from 'react';
import { AlertTriangle, Award, BookOpen, CheckCircle2, Clock3, Loader2, MessageSquareText, X } from 'lucide-react';
import type { InterviewOverallRating, InterviewRound, InterviewRoundInterviewer } from '../types';
import type { InterviewApplicantWithAccess } from '../types';
import { useInterviewNoteLogic } from '../hooks/useInterviewNoteLogic';
import { summarizeAvailabilitySlots } from '../domain/interviews/availabilitySummary';
import { getInterviewProgressStatus } from '../domain/interviews/interviewV3Policy';

interface Props {
  applicant: InterviewApplicantWithAccess | null;
  round: InterviewRound;
  interviewer: InterviewRoundInterviewer | null;
  onClose: () => void;
  onComplete: (applicantId: string, note: {
    generalNotes: string;
    answers: Record<string, string>;
    overallRating: InterviewOverallRating | null;
    expectedNoteRevision?: number;
  }) => Promise<boolean>;
  onActionNeeded: (applicantId: string, reason?: string) => Promise<boolean>;
}

const RATINGS: Array<{ value: InterviewOverallRating; label: string }> = [
  { value: 'strongly_recommend', label: '적극 추천' },
  { value: 'recommend', label: '추천' },
  { value: 'neutral', label: '중립' },
  { value: 'not_recommend', label: '비추천' },
  { value: 'strongly_not_recommend', label: '적극 비추천' },
];

export default function InterviewWorkspaceModal({ applicant, round, interviewer, onClose, onComplete, onActionNeeded }: Props) {
  const note = useInterviewNoteLogic(round.id, applicant?.id ?? null, interviewer);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [completionConfirmOpen, setCompletionConfirmOpen] = useState(false);

  useEffect(() => {
    setSubmitting(false);
    setValidationError(null);
    setActionFormOpen(false);
    setActionReason(applicant?.actionNeededReason ?? '');
    setCompletionConfirmOpen(false);
  }, [applicant?.id, applicant?.actionNeededReason]);

  if (!applicant) return null;
  const interviewCompleted = getInterviewProgressStatus(applicant) === 'completed';
  const availability = summarizeAvailabilitySlots(applicant.access?.availability ?? [], round.availabilitySlotMinutes);
  const questions = round.interviewQuestions ?? [];
  const saveLabel = note.state === 'saving'
    ? '자동 저장 중…'
    : note.state === 'conflict'
      ? '다른 운영진의 수정 발견'
      : note.state === 'error'
        ? '저장 실패 · 입력 내용 유지 중'
        : note.state === 'loading'
          ? '노트 불러오는 중…'
          : '자동 저장됨';
  return <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm md:p-5">
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl md:rounded-3xl">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:px-6 md:py-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-gold">Interview workspace</p><h2 className="text-lg font-black text-navy md:text-xl">{applicant.name} <span className="text-sm font-medium text-slate-400">{applicant.applicantNumber}</span></h2><p className="text-xs text-slate-500">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.phone}</p></div><button onClick={onClose} aria-label="면접 화면 닫기" className="rounded-xl bg-slate-100 p-2.5 text-slate-500"><X size={18} /></button></header>
      <div className="grid flex-1 gap-4 overflow-y-auto p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-6">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><BookOpen size={16} className="text-gold" />지원서 답변</h3><dl className="mt-4 space-y-4">{applicant.applicationData.map((field, index) => <div key={`${field.header}-${index}`}><dt className="text-[10px] font-black text-slate-400">{field.header || `항목 ${index + 1}`}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{field.value || '-'}</dd></div>)}{applicant.applicationData.length === 0 && <p className="text-sm text-slate-400">저장된 지원서 답변이 없습니다.</p>}</dl></section>
          <section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><Clock3 size={16} className="text-gold" />지원자 가능시간</h3><div className="mt-3 space-y-2">{availability.map(row => <div key={row.dateKey} className="grid grid-cols-[82px_1fr] gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs"><strong className="text-navy">{row.dateLabel}</strong><span className="text-slate-600">{row.ranges.join(', ')}</span></div>)}{availability.length === 0 && <p className="text-sm text-slate-400">제출된 가능시간이 없습니다.</p>}</div></section>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><MessageSquareText size={16} className="text-gold" />면접 질문과 답변 기록</h3><span className={`flex items-center gap-1 text-[10px] font-bold ${note.state === 'error' || note.state === 'conflict' ? 'text-red-600' : 'text-slate-400'}`}>{note.state === 'saving' || note.state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : note.state === 'conflict' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{saveLabel}</span></div>{note.state === 'conflict' && <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold leading-5 text-amber-900">다른 운영진이 이 면접 기록을 수정했습니다. 현재 입력은 보존되어 있으며 자동 저장을 잠시 멈췄습니다.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={note.acceptRemote} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-amber-800 shadow-sm">서버의 최신 내용 불러오기</button><button type="button" onClick={() => void note.overwriteRemote()} className="rounded-lg bg-amber-700 px-3 py-2 text-[10px] font-black text-white">내 입력으로 덮어쓰기</button></div></div>}{note.state === 'error' && <button type="button" onClick={() => void note.retrySave()} className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[10px] font-black text-red-700">저장 다시 시도</button>}<div className="mt-4 space-y-4">{questions.map((question, index) => <label key={question.id} className="block"><span className="block whitespace-pre-wrap text-xs font-black leading-5 text-navy">{index + 1}. {question.text}</span><textarea value={note.answers[question.id] ?? ''} onChange={event => note.setAnswer(question.id, event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-gold focus:outline-none" placeholder="면접 중 답변과 관찰 내용을 기록하세요." /></label>)}{questions.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700">회차 설정에 면접 질문을 추가하면 이곳에 질문별 입력란이 표시됩니다.</p>}</div></section>
          <section className="rounded-2xl bg-white p-4 shadow-sm"><label className="block"><span className="text-sm font-black text-navy">종합 노트</span><textarea value={note.generalNotes} onChange={event => note.setGeneralNotes(event.target.value)} className="mt-3 min-h-48 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-gold focus:outline-none" placeholder="질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요." /></label></section>
          <section id="overall-rating" className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><Award size={16} className="text-gold" />면접관 종합평가 <span className="text-red-500">필수</span></h3><p className="mt-1 text-xs text-slate-500">평가 근거는 질문별 기록이나 종합 노트에 남겨주세요.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{RATINGS.map(item => <button type="button" key={item.value} onClick={() => { note.setOverallRating(item.value); setValidationError(null); }} className={`min-h-12 rounded-xl border px-2 py-2 text-xs font-black transition ${note.overallRating === item.value ? 'border-navy bg-navy text-white' : 'border-indigo-100 bg-white text-slate-600 hover:border-indigo-300'}`}>{item.label}</button>)}</div>{validationError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{validationError}</p>}</section>
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
        {actionFormOpen && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"><label className="block text-xs font-black text-amber-900">조치가 필요한 이유 <span className="font-medium text-amber-700">(선택)</span><textarea autoFocus value={actionReason} maxLength={500} onChange={event => setActionReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-navy focus:border-amber-400 focus:outline-none" placeholder="불참, 일정 재조율 등 필요한 조치를 적어주세요." /></label><div className="mt-2 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => setActionFormOpen(false)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500">취소</button><button type="button" disabled={submitting} onClick={async () => { setSubmitting(true); try { if (await onActionNeeded(applicant.id, actionReason)) onClose(); } finally { setSubmitting(false); } }} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">조치 필요로 이동</button></div></div>}
        {completionConfirmOpen && <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold leading-5 text-emerald-900">{applicant.name} 지원자의 종합평가와 면접 기록을 저장하고 완료 처리할까요?</p><div className="mt-2 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => setCompletionConfirmOpen(false)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500">취소</button><button type="button" disabled={submitting || note.state === 'conflict'} onClick={async () => { setSubmitting(true); try { const flushed = await note.flush(); if (!flushed.saved) { setValidationError('면접 기록을 먼저 저장하거나 수정 충돌을 해결해주세요.'); return; } if (await onComplete(applicant.id, { generalNotes: note.generalNotes, answers: note.answers, overallRating: note.overallRating, expectedNoteRevision: flushed.revision })) onClose(); } finally { setSubmitting(false); } }} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">완료 처리</button></div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={submitting || interviewCompleted} onClick={() => { setCompletionConfirmOpen(false); setActionFormOpen(current => !current); }} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800 disabled:opacity-40"><AlertTriangle size={15} />조치 필요</button><button type="button" disabled={submitting || interviewCompleted} onClick={() => { if (!note.overallRating) { setValidationError('종합평가를 선택해야 면접을 완료할 수 있습니다.'); document.getElementById('overall-rating')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } setActionFormOpen(false); setCompletionConfirmOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">{submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}{interviewCompleted ? '면접 완료됨' : '평가와 함께 면접 완료'}</button></div>
      </footer>
    </div>
  </div>;
}
