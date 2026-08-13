import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Copy, Download, FileUp, Loader2, MessageSquare, Search, Settings, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Papa from 'papaparse';
import { toast } from 'sonner';
import PageHeader from './PageHeader';
import ApplicantCsvImportModal from './ApplicantCsvImportModal';
import ApplicantDetailModal from './ApplicantDetailModal';
import AvailabilityGrid from './AvailabilityGrid';
import InterviewRoundFormModal from './InterviewRoundFormModal';
import { useInterviewRoundLogic, type InterviewApplicantFilter } from '../hooks/useInterviewRoundLogic';
import { availabilityToAssignmentCandidates, parseSlotId } from '../domain/interviews/scheduling';
import type { InterviewApplicantWithAccess, InterviewRoundDraft } from '../services/interviewsService';

type Tab = 'overview' | 'applicants' | 'availability' | 'assignment' | 'settings';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '개요' }, { id: 'applicants', label: '지원자' }, { id: 'availability', label: '가능시간' }, { id: 'assignment', label: '일정 배정' }, { id: 'settings', label: '설정' },
];
const FILTERS: Array<{ id: InterviewApplicantFilter; label: string }> = [
  { id: 'all', label: '전체' }, { id: 'responded', label: '응답완료' }, { id: 'pending', label: '미응답' }, { id: 'assigned', label: '배정완료' }, { id: 'unassigned', label: '미배정' }, { id: 'availability-unsent', label: '조사 미발송' }, { id: 'availability-sent', label: '조사 발송' }, { id: 'availability-sent-pending', label: '조사 발송 후 미응답' }, { id: 'confirmation-unsent', label: '배정 후 확정 미발송' }, { id: 'confirmation-sent', label: '확정 발송' },
];
function getSurveyStatusLabel(opensAt: Date, closesAt: Date) {
  const now = Date.now();
  if (now < opensAt.getTime()) return '조사 시작 전';
  if (now >= closesAt.getTime()) return '조사 마감';
  return '응답 수집 중';
}

function formatSlot(slot: string) { const parsed = parseSlotId(slot); return parsed ? `${parsed.date} ${parsed.time}` : slot; }
function formatDaySchedules(slots: string[], slotMinutes: number) {
  const timesByDate = new Map<string, string[]>();
  slots.forEach(slot => {
    const parsed = parseSlotId(slot);
    if (!parsed) return;
    const times = timesByDate.get(parsed.date) ?? [];
    times.push(parsed.time);
    timesByDate.set(parsed.date, times);
  });
  return [...timesByDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, times]) => {
    const sortedTimes = [...new Set(times)].sort();
    const [endHourText, endMinuteText] = (sortedTimes.at(-1) ?? '00:00').split(':');
    const endMinutes = Number(endHourText) * 60 + Number(endMinuteText) + slotMinutes;
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));
    return `${dateLabel} ${sortedTimes[0]}~${endTime}`;
  }).join(' / ');
}
function formatAssignment(applicant: InterviewApplicantWithAccess) {
  if (!applicant.assignment) return '';
  return applicant.assignment.slotId
    ? `${formatSlot(applicant.assignment.slotId)} KST`
    : applicant.assignment.startsAt.toDate().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = Papa.unparse(rows, { escapeFormulae: true });
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function InterviewRoundPage() {
  const { roundId = '' } = useParams();
  const logic = useInterviewRoundLogic(roundId);
  const [tab, setTab] = useState<Tab>('overview');
  const [importOpen, setImportOpen] = useState(false);
  const [detailApplicantId, setDetailApplicantId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [assigningApplicantId, setAssigningApplicantId] = useState<string>('');

  const counts = useMemo(() => ({
    total: logic.applicants.length,
    responded: logic.applicants.filter(item => item.access?.submittedAt).length,
    assigned: logic.applicants.filter(item => item.assignment).length,
  }), [logic.applicants]);

  if (logic.loading) return <div className="flex justify-center py-24 text-slate-300"><Loader2 className="animate-spin" /></div>;
  if (!logic.round) return <div className="rounded-2xl bg-white p-12 text-center text-sm font-bold text-slate-500">면접 회차를 찾을 수 없습니다.</div>;
  const round = logic.round;

  const exportApplicants = () => downloadCsv(`${round.name}_지원자.csv`, logic.applicants.map(applicant => ({
    ...Object.fromEntries(applicant.applicationData.map(field => [`지원서_${field.header}`, field.value])),
    지원자번호: applicant.applicantNumber, 이름: applicant.name, 연락처: applicant.phone, 개인링크: applicant.link,
    응답여부: applicant.access?.submittedAt ? '완료' : '미응답', 가능시간: applicant.access?.availability.map(formatSlot).join(' / ') ?? '',
    면접시간: formatAssignment(applicant),
    조사안내: applicant.availabilityMessage.firstMarkedSentAt ? '발송' : '미발송', 확정안내: applicant.confirmationMessage.firstMarkedSentAt ? '발송' : '미발송',
  })));

  const applySettings = async (draft: InterviewRoundDraft) => {
    const impact = logic.previewScheduleImpact(draft);
    if (impact.affectedResponseCount > 0 || impact.affectedAssignmentCount > 0) {
      const applicantsById = new Map(logic.applicants.map(applicant => [applicant.id, applicant.name]));
      const responsePreview = impact.affectedResponses.slice(0, 6).map(item => (
        `- ${applicantsById.get(item.applicantId) ?? item.applicantId}: ${item.removedSlots.map(formatSlot).join(', ')}`
      )).join('\n');
      const responseRemainder = impact.affectedResponses.length > 6 ? `\n- 그 외 ${impact.affectedResponses.length - 6}명` : '';
      const assignmentPreview = impact.affectedAssignments.slice(0, 6).map(item => (
        `- ${applicantsById.get(item.applicantId) ?? item.applicantId}: ${item.slotId ? formatSlot(item.slotId) : '기존 형식 배정'}`
      )).join('\n');
      const assignmentRemainder = impact.affectedAssignments.length > 6 ? `\n- 그 외 ${impact.affectedAssignments.length - 6}명` : '';
      const sections = [
        impact.affectedResponseCount > 0
          ? `응답 선택 정리 ${impact.affectedResponseCount}명 / ${impact.removedSelectionCount}개\n${responsePreview}${responseRemainder}`
          : '',
        impact.affectedAssignmentCount > 0
          ? `기존 면접 배정 해제 ${impact.affectedAssignmentCount}명\n${assignmentPreview}${assignmentRemainder}`
          : '',
      ].filter(Boolean).join('\n\n');
      const confirmed = window.confirm(
        `일정 변경 영향 미리보기\n\n${sections}\n\n확인을 누르면 회차 설정 저장, 무효 선택 정리, 유효하지 않은 기존 배정 해제를 한 번에 실행합니다.`,
      );
      if (!confirmed) return false;
    }
    return logic.applySchedule(draft);
  };

  const availableAtSelected = selectedSlot ? logic.aggregateAvailability[selectedSlot] ?? [] : [];
  const availabilityCounts = new Map(round.allowedSlots.map(slot => [slot, (logic.aggregateAvailability[slot] ?? []).length]));
  const detailApplicant = logic.applicants.find(applicant => applicant.id === detailApplicantId) ?? null;

  return <div className="space-y-6">
    <div><Link to="/interviews" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-navy"><ArrowLeft size={14} />면접 회차 목록</Link><PageHeader title={round.name} subtitle="Operations / Interview Round" icon={CalendarClock} stats={{ label: '지원자', value: counts.total }} actions={<div className="flex gap-2"><button onClick={exportApplicants} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-navy"><Download size={15} />CSV</button><button onClick={() => setImportOpen(true)} className="flex items-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-xs font-black text-white hover:bg-gold"><FileUp size={15} />지원자 등록</button></div>} /></div>
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm">{TABS.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${tab === item.id ? 'bg-navy text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-navy'}`}>{item.label}</button>)}</nav>

    {tab === 'overview' && <div className="grid gap-4 md:grid-cols-3"><Metric label="전체 지원자" value={counts.total} tone="navy" /><Metric label="응답 완료" value={counts.responded} tone="green" /><Metric label="면접 배정" value={counts.assigned} tone="gold" /><section className="rounded-3xl bg-white p-5 shadow-sm md:col-span-2"><h3 className="text-xs font-black text-navy">조사 운영 정보</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="조사 시작" value={round.surveyOpensAt.toDate().toLocaleString('ko-KR')} /><Info label="조사 마감" value={round.surveyClosesAt.toDate().toLocaleString('ko-KR')} /><Info label="날짜별 면접 시간" value={formatDaySchedules(round.allowedSlots, round.availabilitySlotMinutes)} /><Info label="응답/배정 단위" value={`${round.availabilitySlotMinutes}분 / ${round.assignmentSlotMinutes}분`} /><Info label="조사 상태" value={getSurveyStatusLabel(round.surveyOpensAt.toDate(), round.surveyClosesAt.toDate())} /></dl></section><section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="text-xs font-black text-navy">안내문</h3><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{round.instructions}</p></section></div>}

    {tab === 'applicants' && <section className="space-y-4"><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-300" size={16} /><input value={logic.search} onChange={event => logic.setSearch(event.target.value)} className="w-full rounded-xl border border-slate-100 py-2 pl-9 pr-3 text-sm" placeholder="이름, 번호, 연락처 검색" /></div><div className="mt-3 flex gap-2 overflow-x-auto">{FILTERS.map(item => <button key={item.id} onClick={() => logic.setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold ${logic.filter === item.id ? 'bg-navy text-white' : 'bg-slate-50 text-slate-500'}`}>{item.label}</button>)}</div></div><div className="space-y-2">{logic.filteredApplicants.map(applicant => <ApplicantRow key={applicant.id} applicant={applicant} onOpen={() => setDetailApplicantId(applicant.id)} />)}</div></section>}

    {tab === 'availability' && <section className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="rounded-3xl bg-white p-4 shadow-sm"><AvailabilityGrid slots={round.allowedSlots} counts={availabilityCounts} onCountClick={setSelectedSlot} /></div><aside className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="text-xs font-black text-navy">{selectedSlot ? formatSlot(selectedSlot) : '시간을 선택하세요'}</h3><div className="mt-4 space-y-2">{availableAtSelected.map(applicant => <button key={applicant.id} onClick={() => setDetailApplicantId(applicant.id)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-xs"><span className="font-bold text-navy">{applicant.name}</span><span className="text-slate-400">{applicant.phone}</span></button>)}</div></aside></section>}

    {tab === 'assignment' && <section className="space-y-3"><div className="rounded-2xl bg-indigo-50 px-4 py-3 text-xs leading-5 text-navy"><strong>현재 운영:</strong> 기본 면접관 1명 기준입니다. 각 배정에는 개인 면접관 ID가 저장되어, 추후 여러 면접관을 개인 단위로 추가하면 서로 다른 면접관의 같은 시각 배정을 허용할 수 있습니다.</div>{logic.applicants.map(applicant => { const candidates = availabilityToAssignmentCandidates(applicant.access?.availability ?? [], round.availabilitySlotMinutes, round.assignmentSlotMinutes); return <article key={applicant.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-navy">{applicant.name}</p><p className="text-[11px] text-slate-400">{applicant.assignment ? `배정: ${formatAssignment(applicant)} · ${applicant.assignment.durationMinutes}분 · 기본 면접관` : '미배정'}</p></div><div className="flex min-w-0 gap-2"><select value={assigningApplicantId === applicant.id ? selectedSlot ?? '' : ''} onFocus={() => { setAssigningApplicantId(applicant.id); setSelectedSlot(null); }} onChange={event => { setAssigningApplicantId(applicant.id); setSelectedSlot(event.target.value); }} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="">가능 시간 선택</option>{candidates.map(slot => { const conflict = logic.getAssignmentConflict(slot, applicant.id); return <option key={slot} value={slot} disabled={Boolean(conflict)}>{formatSlot(slot)}{conflict ? ` · 배정됨 (${conflict.name})` : ''}</option>; })}</select><button disabled={assigningApplicantId !== applicant.id || !selectedSlot} onClick={async () => { if (!selectedSlot) return; const saved = await logic.assignApplicant(applicant, selectedSlot); if (saved) { setSelectedSlot(null); setAssigningApplicantId(''); } }} className="rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-40">배정</button>{applicant.assignment && <button onClick={() => logic.clearAssignment(applicant.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">해제</button>}</div></div></article>; })}</section>}

    {tab === 'settings' && <section className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black text-navy">회차 설정</h3><p className="mt-1 text-sm text-slate-500">조사 기간, 면접 날짜, 시간 범위, 슬롯 단위, 메시지 템플릿을 관리합니다.</p><p className="mt-2 text-xs font-bold text-amber-600">일정 변경 시 기존 응답에 포함된 무효 슬롯을 미리 계산하고 확인 후 일괄 정리합니다.</p></div><button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white"><Settings size={15} />설정 변경</button></div></section>}

    <ApplicantCsvImportModal open={importOpen} onClose={() => setImportOpen(false)} onConfirm={logic.importRows} />
    <ApplicantDetailModal applicant={detailApplicant} round={round} onClose={() => setDetailApplicantId(null)} onMarkSent={(kind, markedSent) => detailApplicant ? logic.markSent(detailApplicant.id, kind, markedSent) : Promise.resolve()} />
    <InterviewRoundFormModal open={settingsOpen} round={round} onClose={() => setSettingsOpen(false)} onSave={applySettings} />
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'navy' | 'green' | 'gold' }) { const styles = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'gold' ? 'bg-amber-50 text-amber-700' : 'bg-white text-navy'; return <div className={`rounded-3xl p-5 shadow-sm ${styles}`}><p className="text-[10px] font-bold uppercase opacity-60">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-700">{value}</dd></div>; }
function ApplicantRow({ applicant, onOpen }: { applicant: InterviewApplicantWithAccess; onOpen: () => void }) {
  const responseUpdatedAt = (applicant.access?.responseUpdatedAt ?? applicant.access?.updatedAt)?.toDate().toLocaleString('ko-KR') ?? '-';
  const assignedAt = applicant.assignment ? formatAssignment(applicant) : '-';
  const confirmationIsCurrent = Boolean(applicant.assignment) && Boolean(applicant.confirmationMessage.firstMarkedSentAt)
    && (applicant.assignmentRevision ?? applicant.assignment?.confirmationRevision ?? 0) === (applicant.confirmationMessage.assignmentRevision ?? 0);
  return <article className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:bg-indigo-50 sm:flex-row sm:items-center">
    <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-3 text-left lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-[180px] items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-navy"><Users size={16} /></span><div><p className="font-black text-navy">{applicant.name} <span className="text-xs font-normal text-slate-400">{applicant.applicantNumber}</span></p><p className="text-[11px] text-slate-400">{applicant.phone}</p></div></div>
      <div className="grid flex-1 gap-2 text-[10px] sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-slate-400">시간 응답</p><Badge active={Boolean(applicant.access?.submittedAt)} on="완료" off="미응답" /><p className="mt-1 text-slate-400">수정 {responseUpdatedAt}</p></div><div><p className="text-slate-400">조사 안내</p><Badge active={Boolean(applicant.availabilityMessage.firstMarkedSentAt)} on="발송 표시" off="미발송" /></div><div><p className="text-slate-400">면접시간</p><Badge active={Boolean(applicant.assignment)} on={assignedAt} off="미배정" /></div><div><p className="text-slate-400">확정 안내</p><Badge active={confirmationIsCurrent} on="발송 표시" off={applicant.confirmationMessage.firstMarkedSentAt ? '재발송 필요' : '미발송'} /></div></div>
    </button>
    <div className="flex shrink-0 gap-2"><button onClick={() => navigator.clipboard.writeText(applicant.link).then(() => toast.success('링크를 복사했습니다.')).catch(() => toast.error('링크를 복사하지 못했습니다.'))} title="개인 링크 복사" className="rounded-xl bg-slate-100 p-2.5 text-slate-500"><Copy size={14} /></button><button onClick={onOpen} className="flex items-center gap-1 rounded-xl bg-navy px-3 py-2 text-[11px] font-bold text-white"><MessageSquare size={14} />문자</button></div>
  </article>;
}
function Badge({ active, on, off }: { active: boolean; on: string; off: string }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{active ? on : off}</span>; }
