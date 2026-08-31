import { useState } from 'react';
import { CalendarDays, Loader2, Trash2 } from 'lucide-react';
import { getInterviewScheduleEndDate, getInterviewScheduleStartDate } from '../domain/interviews/scheduleOrder';
import type { InterviewApplicantWithAccess, InterviewSchedule } from '../types';

interface Props {
  schedules: InterviewSchedule[];
  applicants: InterviewApplicantWithAccess[];
  onDelete: (schedule: InterviewSchedule) => Promise<boolean>;
}

function formatDateRange(schedule: InterviewSchedule) {
  const start = getInterviewScheduleStartDate(schedule);
  const end = getInterviewScheduleEndDate(schedule);
  if (!start || !end) return '면접 날짜 미설정';
  return start === end ? start : `${start} ~ ${end}`;
}

function scheduleLabel(schedule: InterviewSchedule) {
  if (schedule.status === 'archived') return '기존 보관 일정';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = getInterviewScheduleEndDate(schedule);
  return end && end < today ? '지난 일정' : '예정 일정';
}

export default function InterviewScheduleManagement({ schedules, applicants, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteSchedule = async (schedule: InterviewSchedule) => {
    const applicantCount = applicants.filter(applicant => applicant.scheduleId === schedule.id).length;
    if (applicantCount > 0) return;
    if (!window.confirm(`“${schedule.name}” 일정을 영구 삭제할까요?\n\n삭제 후에는 복구할 수 없습니다.`)) return;
    setDeletingId(schedule.id);
    try {
      await onDelete(schedule);
    } finally {
      setDeletingId(null);
    }
  };

  return <section className="rounded-3xl bg-white p-6 shadow-sm">
    <div>
      <h3 className="font-black text-navy">일정 관리</h3>
      <p className="mt-1 text-sm text-slate-500">면접 시작 날짜순으로 표시합니다. 지원자나 면접 기록이 연결된 일정은 삭제할 수 없습니다.</p>
    </div>
    <div className="mt-5 space-y-3">
      {schedules.map(schedule => {
        const applicantCount = applicants.filter(applicant => applicant.scheduleId === schedule.id).length;
        const deleting = deletingId === schedule.id;
        const canDelete = applicantCount === 0;
        return <article key={schedule.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl bg-slate-100 p-2.5 text-navy"><CalendarDays size={17} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm font-black text-navy">{schedule.name}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{scheduleLabel(schedule)}</span></div>
              <p className="mt-1 text-xs text-slate-500">{formatDateRange(schedule)} · 연결된 지원자 {applicantCount}명</p>
            </div>
          </div>
          <button type="button" disabled={!canDelete || deleting || deletingId !== null} title={canDelete ? '일정 영구 삭제' : '연결된 지원자 또는 기록이 있어 삭제할 수 없습니다.'} onClick={() => void deleteSchedule(schedule)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {canDelete ? '일정 삭제' : '삭제할 수 없음'}
          </button>
        </article>;
      })}
      {schedules.length === 0 && <p className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-400">등록된 면접 일정이 없습니다.</p>}
    </div>
  </section>;
}
