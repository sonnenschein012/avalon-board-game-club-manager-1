import { BookOpen, CheckCircle2, Clock3, Loader2, MessageSquareText, X } from 'lucide-react';
import type { InterviewRound, InterviewRoundInterviewer } from '../types';
import type { InterviewApplicantWithAccess } from '../services/interviewsService';
import { useInterviewNoteLogic } from '../hooks/useInterviewNoteLogic';
import { summarizeAvailabilitySlots } from '../domain/interviews/availabilitySummary';

interface Props {
  applicant: InterviewApplicantWithAccess | null;
  round: InterviewRound;
  interviewer: InterviewRoundInterviewer | null;
  onClose: () => void;
}

export default function InterviewWorkspaceModal({ applicant, round, interviewer, onClose }: Props) {
  const note = useInterviewNoteLogic(round.id, applicant?.id ?? null, interviewer);
  if (!applicant) return null;
  const availability = summarizeAvailabilitySlots(applicant.access?.availability ?? [], round.availabilitySlotMinutes);
  const questions = round.interviewQuestions ?? [];
  const saveLabel = note.state === 'saving' ? '자동 저장 중…' : note.state === 'error' ? '저장 실패 · 입력 내용 유지 중' : note.state === 'loading' ? '노트 불러오는 중…' : '자동 저장됨';
  return <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm md:p-5">
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl md:rounded-3xl">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:px-6 md:py-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-gold">Interview workspace</p><h2 className="text-lg font-black text-navy md:text-xl">{applicant.name} <span className="text-sm font-medium text-slate-400">{applicant.applicantNumber}</span></h2><p className="text-xs text-slate-500">{applicant.assignment?.slotId?.replace('|', ' ')} · {applicant.phone}</p></div><button onClick={onClose} aria-label="면접 화면 닫기" className="rounded-xl bg-slate-100 p-2.5 text-slate-500"><X size={18} /></button></header>
      <div className="grid flex-1 gap-4 overflow-y-auto p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-6">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><BookOpen size={16} className="text-gold" />지원서 답변</h3><dl className="mt-4 space-y-4">{applicant.applicationData.map((field, index) => <div key={`${field.header}-${index}`}><dt className="text-[10px] font-black text-slate-400">{field.header || `항목 ${index + 1}`}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{field.value || '-'}</dd></div>)}{applicant.applicationData.length === 0 && <p className="text-sm text-slate-400">저장된 지원서 답변이 없습니다.</p>}</dl></section>
          <section className="rounded-2xl bg-white p-4 shadow-sm"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><Clock3 size={16} className="text-gold" />지원자 가능시간</h3><div className="mt-3 space-y-2">{availability.map(row => <div key={row.dateKey} className="grid grid-cols-[82px_1fr] gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs"><strong className="text-navy">{row.dateLabel}</strong><span className="text-slate-600">{row.ranges.join(', ')}</span></div>)}{availability.length === 0 && <p className="text-sm text-slate-400">제출된 가능시간이 없습니다.</p>}</div></section>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-black text-navy"><MessageSquareText size={16} className="text-gold" />면접 질문과 답변 기록</h3><span className={`flex items-center gap-1 text-[10px] font-bold ${note.state === 'error' ? 'text-red-600' : 'text-slate-400'}`}>{note.state === 'saving' || note.state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}{saveLabel}</span></div><div className="mt-4 space-y-4">{questions.map((question, index) => <label key={question.id} className="block"><span className="block text-xs font-black leading-5 text-navy">{index + 1}. {question.text}</span><textarea value={note.answers[question.id] ?? ''} onChange={event => note.setAnswer(question.id, event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-gold focus:outline-none" placeholder="면접 중 답변과 관찰 내용을 기록하세요." /></label>)}{questions.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700">회차 설정에 면접 질문을 추가하면 이곳에 질문별 입력란이 표시됩니다.</p>}</div></section>
          <section className="rounded-2xl bg-white p-4 shadow-sm"><label className="block"><span className="text-sm font-black text-navy">종합 노트</span><textarea value={note.generalNotes} onChange={event => note.setGeneralNotes(event.target.value)} className="mt-3 min-h-48 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-gold focus:outline-none" placeholder="질문 외 추가 메모, 후속 확인 사항 등을 자유롭게 기록하세요." /></label></section>
        </div>
      </div>
    </div>
  </div>;
}
