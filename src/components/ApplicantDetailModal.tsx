import { useMemo, useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, MessageSquare, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import type { InterviewRound, InterviewRoundInterviewer, InterviewSchedule } from '../types';
import type { InterviewApplicantWithAccess } from '../types';
import { renderInterviewMessage, resolveInterviewMessageTemplates } from '../domain/interviews/messages';
import { isAssignmentOutsideAvailability, parseSlotId } from '../domain/interviews/scheduling';
import { summarizeAvailabilitySlots } from '../domain/interviews/availabilitySummary';

interface ApplicantDetailModalProps {
  applicant: InterviewApplicantWithAccess | null;
  round: InterviewRound;
  schedule?: InterviewSchedule | null;
  interviewers: InterviewRoundInterviewer[];
  onClose: () => void;
  onMarkSent: (
    kind: 'availabilityMessage' | 'reminderMessage' | 'confirmationMessage',
    markedSent: boolean,
  ) => Promise<void>;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard API is unavailable.');
}

function formatTimestamp(value: { toDate(): Date } | null | undefined) {
  return value ? value.toDate().toLocaleString('ko-KR') : '-';
}

function getAssignmentParts(applicant: InterviewApplicantWithAccess | null) {
  const assignmentDate = applicant?.assignment?.startsAt.toDate();
  const parsedAssignment = applicant?.assignment?.slotId ? parseSlotId(applicant.assignment.slotId) : null;
  return {
    date: parsedAssignment?.date ?? (assignmentDate ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(assignmentDate) : ''),
    time: parsedAssignment?.time ?? (assignmentDate ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(assignmentDate) : ''),
  };
}

function getStoredAssignmentParts(assignment: InterviewApplicantWithAccess['assignment']) {
  const date = assignment?.startsAt.toDate();
  const parsed = assignment?.slotId ? parseSlotId(assignment.slotId) : null;
  return {
    date: parsed?.date ?? (date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date) : ''),
    time: parsed?.time ?? (date ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : ''),
  };
}

export default function ApplicantDetailModal({ applicant, round, schedule, interviewers, onClose, onMarkSent }: ApplicantDetailModalProps) {
  const [pendingMessageKind, setPendingMessageKind] = useState<'availability' | 'reminder' | 'confirmation' | null>(null);
  const messages = useMemo(() => {
    if (!applicant) return { availability: '', reminder: '', confirmation: '', reschedule: '', selected: '', rejected: '' };
    const assignmentParts = getAssignmentParts(applicant);
    const previousParts = getStoredAssignmentParts(applicant.previousAssignment ?? null);
    const assignedInterviewer = interviewers.find(item => item.interviewerId === applicant.assignment?.interviewerId);
    const interviewerName = applicant.assignment?.interviewerName ?? assignedInterviewer?.displayName ?? '';
    const interviewerPhone = assignedInterviewer?.phone?.trim() || '';
    const placeholders = { name: applicant.name, link: applicant.link, ...(schedule ? { deadline: schedule.surveyClosesAt.toDate().toLocaleString('ko-KR') } : {}), interviewDate: assignmentParts.date, interviewTime: assignmentParts.time, oldInterviewDate: previousParts.date, oldInterviewTime: previousParts.time, interviewerName, interviewerPhone, roundName: round.name };
    const templates = resolveInterviewMessageTemplates(round.messageTemplates);
    return Object.fromEntries(Object.entries(templates).map(([kind, template]) => [
      kind,
      renderInterviewMessage(template, placeholders),
    ])) as Record<keyof typeof templates, string>;
  }, [applicant, interviewers, round, schedule]);
  if (!applicant) return null;
  const assignmentParts = getAssignmentParts(applicant);
  const launchSms = (message: string) => { window.location.href = `sms:${encodeURIComponent(applicant.phone)}?body=${encodeURIComponent(message)}`; };
  const copyWithFeedback = async (text: string, label: string) => {
    try {
      await copyText(text);
      toast.success(`${label}을(를) 복사했습니다.`);
    } catch {
      toast.error(`${label}을(를) 복사하지 못했습니다.`);
    }
  };
  const selectedAvailability = summarizeAvailabilitySlots(applicant.access?.availability ?? [], schedule?.availabilitySlotMinutes ?? round.availabilitySlotMinutes);
  const responseConflictsWithAssignment = isAssignmentOutsideAvailability(
    applicant.access?.availability ?? [],
    applicant.assignment?.slotId,
    schedule?.availabilitySlotMinutes ?? round.availabilitySlotMinutes,
    schedule?.assignmentSlotMinutes ?? round.assignmentSlotMinutes,
  );
  const withdrawn = (applicant.applicationStatus ?? 'active') === 'withdrawn';
  const assignedInterviewerPhone = interviewers.find(item => item.interviewerId === applicant.assignment?.interviewerId)?.phone?.trim() ?? '';

  const toggleSentStatus = async (
    kind: 'availability' | 'reminder' | 'confirmation',
    title: string,
    markAsSent: boolean,
    isResend = false,
  ) => {
    const confirmed = window.confirm(markAsSent
      ? `${title}${isResend ? '를 다시' : '를'} 실제로 발송했나요?\n확인을 누르면 발송 완료로 기록합니다.`
      : `${title}의 발송 완료 기록을 취소할까요?`);
    if (!confirmed) return;
    setPendingMessageKind(kind);
    try {
      const field = kind === 'availability'
        ? 'availabilityMessage'
        : kind === 'reminder'
          ? 'reminderMessage'
          : 'confirmationMessage';
      await onMarkSent(field, markAsSent);
    } finally {
      setPendingMessageKind(null);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="text-lg font-black text-navy">{applicant.name}</h2><p className="text-xs text-slate-400">{applicant.applicantNumber} · {applicant.phone}</p></div><button onClick={onClose} className="p-2 text-slate-400"><X size={18} /></button></div><div className="space-y-5 p-5">
    <section className="grid gap-2 sm:grid-cols-3"><button onClick={() => copyWithFeedback(applicant.phone, '전화번호')} className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-navy"><Phone size={14} />전화번호 복사</button><button disabled={withdrawn} onClick={() => copyWithFeedback(applicant.link, '개인 링크')} className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-navy disabled:opacity-35"><Copy size={14} />개인 링크 복사</button>{withdrawn ? <span className="flex items-center justify-center rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">지원 철회 · 링크 차단</span> : <a href={applicant.link} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-navy"><ExternalLink size={14} />링크 열기</a>}</section>
    <section className="grid gap-3 rounded-2xl bg-indigo-50 p-4 text-xs sm:grid-cols-3"><div><p className="font-bold text-slate-400">최초 유효 접속</p><p className="mt-1 font-black text-navy">{formatTimestamp(applicant.access?.firstAccessedAt)}</p></div><div><p className="font-bold text-slate-400">가능시간 응답</p><p className="mt-1 font-black text-navy">{applicant.access?.submittedAt ? '응답 완료' : '미응답'}</p><p className="mt-1 text-slate-500">지원자 최종 수정 {formatTimestamp(applicant.access?.responseUpdatedAt ?? applicant.access?.updatedAt)}</p></div><div><p className="font-bold text-slate-400">최종 면접시간</p><p className="mt-1 font-black text-navy">{applicant.assignment ? `${assignmentParts.date} ${assignmentParts.time} KST` : '미배정'}</p></div><div className="space-y-2 sm:col-span-3"><p className="font-bold text-slate-400">선택한 가능시간</p>{selectedAvailability.length > 0 ? selectedAvailability.map(row => <div key={row.dateKey} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 rounded-xl bg-white/80 px-3 py-2"><span className="font-black text-navy">{row.dateLabel}</span><span className="font-medium leading-5 text-slate-600">{row.ranges.join(', ')}</span></div>) : <p className="rounded-xl bg-white/80 px-3 py-2 text-slate-500">선택한 시간이 없습니다.</p>}</div></section>
    {responseConflictsWithAssignment && <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>지원자가 응답을 수정하여 현재 배정 시간이 최신 가능시간에 포함되지 않습니다. 변경 필요 여부를 확인해주세요.</span></div>}
    <section className="rounded-2xl border border-slate-100 p-4"><h3 className="mb-3 text-xs font-black text-navy">지원서 원본 정보</h3><dl className="grid gap-3 sm:grid-cols-2">{applicant.applicationData.map((field, index) => <div key={`${field.header}-${index}`}><dt className="text-[10px] font-bold text-slate-400">{field.header || `(열 ${index + 1})`}</dt><dd className="whitespace-pre-wrap text-sm text-slate-700">{field.value || '-'}</dd></div>)}</dl></section>
    {(['availability', 'reminder', ...(applicant.previousAssignment ? ['reschedule'] as const : []), 'confirmation', ...(applicant.selectionStatus === 'selected' ? ['selected'] as const : applicant.selectionStatus === 'rejected' ? ['rejected'] as const : [])] as const).map(kind => {
      const message = messages[kind];
      const isConfirmation = kind === 'confirmation' || kind === 'reschedule';
      const isSelectionNotice = kind === 'selected' || kind === 'rejected';
      const status = kind === 'availability'
        ? applicant.availabilityMessage
        : kind === 'reminder'
          ? applicant.reminderMessage
          : applicant.confirmationMessage;
      const isMarkedSent = Boolean(status?.firstMarkedSentAt);
      const surveyMessageUnavailable = !isConfirmation && !isSelectionNotice && !schedule;
      const confirmationContactUnavailable = Boolean(isConfirmation && applicant.assignment && !assignedInterviewerPhone);
      const disabled = isSelectionNotice || (isConfirmation && !applicant.assignment) || confirmationContactUnavailable || surveyMessageUnavailable || pendingMessageKind !== null;
      const confirmationNeedsResend = isConfirmation
        && isMarkedSent
        && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0) !== (status?.assignmentRevision ?? 0);
      const markAsSent = confirmationNeedsResend || !isMarkedSent;
      const title = kind === 'availability'
        ? '가능시간 조사 안내'
        : kind === 'reminder'
          ? '미응답 재안내'
          : kind === 'reschedule' ? '일정 변경 안내' : kind === 'selected' ? '선발 안내' : kind === 'rejected' ? '미선발 안내' : '최종 면접 안내';
      return <section key={kind} className="rounded-2xl bg-slate-50 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black text-navy">{title}</h3>
          {!isSelectionNotice && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${confirmationNeedsResend ? 'bg-red-100 text-red-700' : isMarkedSent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {confirmationNeedsResend ? '시간 변경 · 재발송 필요' : isMarkedSent ? '발송 표시' : '미발송'}
          </span>}
        </div>
        {!isSelectionNotice && <p className="mb-2 text-[10px] text-slate-400">
          최초 {formatTimestamp(status?.firstMarkedSentAt)} · 최근 {formatTimestamp(status?.lastMarkedSentAt)}
        </p>}
        {surveyMessageUnavailable
          ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">면접 일정을 먼저 지정하면 해당 조사의 마감일이 포함된 문구가 생성됩니다.</p>
          : confirmationContactUnavailable
          ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">담당 면접관의 연락용 전화번호를 먼저 등록하면 최종 안내 문구가 생성됩니다.</p>
          : isConfirmation && !applicant.assignment
          ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">면접시간을 먼저 배정하면 날짜와 시간이 포함된 문구가 생성됩니다.</p>
          : <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-600">{message}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={(isConfirmation && !applicant.assignment) || confirmationContactUnavailable || surveyMessageUnavailable} onClick={() => copyWithFeedback(message, '메시지 문구')} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-navy disabled:opacity-40"><Copy size={13} className="mr-1 inline" />문구 복사</button>
          <button disabled={(isConfirmation && !applicant.assignment) || confirmationContactUnavailable || surveyMessageUnavailable} onClick={() => launchSms(message)} className="rounded-lg bg-navy px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><MessageSquare size={13} className="mr-1 inline" />문자 앱 열기</button>
          {!isSelectionNotice && <button
            disabled={disabled}
            onClick={() => toggleSentStatus(kind === 'reschedule' ? 'confirmation' : kind, title, markAsSent, confirmationNeedsResend)}
            className={`rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-40 ${markAsSent ? 'bg-emerald-600 text-white' : 'bg-white text-red-600'}`}
          >
            {pendingMessageKind === kind ? '변경 중…' : confirmationNeedsResend ? '재발송 완료 표시' : isMarkedSent ? '발송 표시 취소' : '발송 완료 표시'}
          </button>}
        </div>
      </section>;
    })}
  </div></div></div>;
}
