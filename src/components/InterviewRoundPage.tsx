import { useMemo, useState } from 'react';
import { Archive, ArrowDownAZ, ArrowLeft, ArrowUpAZ, CalendarClock, Copy, Download, FileUp, Loader2, MessageSquare, RotateCcw, Search, Settings, UserMinus, UserPlus, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Papa from 'papaparse';
import { toast } from 'sonner';
import PageHeader from './PageHeader';
import ApplicantCsvImportModal from './ApplicantCsvImportModal';
import ApplicantDetailModal from './ApplicantDetailModal';
import InterviewRoundFormModal from './InterviewRoundFormModal';
import ApplicantFormModal from './ApplicantFormModal';
import InterviewersPanel from './InterviewersPanel';
import InterviewerDashboard from './InterviewerDashboard';
import InterviewSchedulePanel from './InterviewSchedulePanel';
import SelectionPanel from './SelectionPanel';
import { useInterviewRoundLogic, type InterviewApplicantFilter } from '../hooks/useInterviewRoundLogic';
import { parseSlotId } from '../domain/interviews/scheduling';
import type { InterviewRoundDraft } from '../services/interviewsService';
import type { InterviewApplicantWithAccess } from '../types';
import { sortInterviewApplicants, type ApplicantSortKey } from '../domain/interviews/applicantSort';
import { getApplicantJourney } from '../domain/interviews/applicantJourney';
import ApplicantJourney from './ApplicantJourney';

type Tab = 'overview' | 'applicants' | 'schedule' | 'interviewers' | 'progress' | 'selection' | 'settings';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '개요' }, { id: 'applicants', label: '지원자' }, { id: 'schedule', label: '일정' }, { id: 'interviewers', label: '면접관 관리' }, { id: 'progress', label: '면접 진행' }, { id: 'selection', label: '선발' }, { id: 'settings', label: '설정' },
];
const FILTERS: Array<{ id: InterviewApplicantFilter; label: string }> = [
  { id: 'all', label: '전체' }, { id: 'responded', label: '응답완료' }, { id: 'pending', label: '미응답' }, { id: 'assigned', label: '배정완료' }, { id: 'unassigned', label: '미배정' }, { id: 'availability-unsent', label: '조사 미발송' }, { id: 'availability-sent', label: '조사 발송' }, { id: 'availability-sent-pending', label: '조사 발송 후 미응답' }, { id: 'confirmation-unsent', label: '배정 후 확정 미발송' }, { id: 'confirmation-sent', label: '확정 발송' }, { id: 'withdrawn', label: '지원 철회' }, { id: 'archived', label: '보관됨' },
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
    ? `${formatSlot(applicant.assignment.slotId)} · ${applicant.assignment.interviewerName}`
    : applicant.assignment.startsAt.toDate().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = Papa.unparse(rows, { escapeFormulae: true });
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function InterviewRoundPage({ isAdminModeActive = false }: { isAdminModeActive?: boolean }) {
  const { roundId = '' } = useParams();
  const logic = useInterviewRoundLogic(roundId);
  const [tab, setTab] = useState<Tab>('overview');
  const [importOpen, setImportOpen] = useState(false);
  const [detailApplicantId, setDetailApplicantId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [applicantFormOpen, setApplicantFormOpen] = useState(false);
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ApplicantSortKey>('applicantNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(() => ({
    total: logic.applicants.filter(item => (item.lifecycle ?? 'active') === 'active' && (item.applicationStatus ?? 'active') === 'active').length,
    responded: logic.applicants.filter(item => (item.lifecycle ?? 'active') === 'active' && (item.applicationStatus ?? 'active') === 'active' && item.access?.submittedAt).length,
    assigned: logic.applicants.filter(item => (item.lifecycle ?? 'active') === 'active' && (item.applicationStatus ?? 'active') === 'active' && item.assignment).length,
  }), [logic.applicants]);
  const applicationHeaders = useMemo(() => [...new Set(logic.applicants.flatMap(applicant => applicant.applicationData.map(field => field.header.trim()).filter(Boolean)))].sort((left, right) => left.localeCompare(right, 'ko-KR')), [logic.applicants]);
  const sortedApplicants = useMemo(() => sortInterviewApplicants(logic.filteredApplicants, sortKey, sortDirection), [logic.filteredApplicants, sortDirection, sortKey]);

  if (logic.loading) return <div className="flex justify-center py-24 text-slate-300"><Loader2 className="animate-spin" /></div>;
  if (!logic.round) return <div className="rounded-2xl bg-white p-12 text-center text-sm font-bold text-slate-500">면접 회차를 찾을 수 없습니다.</div>;
  const round = logic.round;

  const exportApplicants = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { filename, rows } = await logic.getApplicantExport();
      downloadCsv(filename, rows);
      toast.success(`${rows.length}명의 지원자 정보를 내보냈습니다.`);
    } catch (error) {
      console.error(error);
      toast.error('지원자 전체 정보를 내보내지 못했습니다.');
    } finally {
      setExporting(false);
    }
  };

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

  const detailApplicant = logic.applicants.find(applicant => applicant.id === detailApplicantId) ?? null;

  return <div className="space-y-6">
    <div><Link to="/interviews" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-navy"><ArrowLeft size={14} />면접 회차 목록</Link><PageHeader title={round.name} subtitle="Operations / Interview Round" icon={CalendarClock} stats={{ label: '지원자', value: counts.total }} actions={<div className="flex flex-wrap gap-2">{isAdminModeActive && <button type="button" onClick={() => void exportApplicants()} disabled={exporting} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-navy disabled:opacity-50">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}전체 CSV 내보내기</button>}<button onClick={() => { setEditingApplicantId(null); setApplicantFormOpen(true); }} className="flex items-center gap-2 rounded-xl border border-navy px-3 py-2.5 text-xs font-black text-navy"><UserPlus size={15} />개별 추가</button><button onClick={() => setImportOpen(true)} className="flex items-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-xs font-black text-white hover:bg-gold"><FileUp size={15} />CSV 병합</button></div>} /></div>
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm">{TABS.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${tab === item.id ? 'bg-navy text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-navy'}`}>{item.label}</button>)}</nav>

    {tab === 'overview' && <div className="grid gap-4 md:grid-cols-3"><Metric label="전체 지원자" value={counts.total} tone="navy" /><Metric label="응답 완료" value={counts.responded} tone="green" /><Metric label="면접 배정" value={counts.assigned} tone="gold" /><section className="rounded-3xl bg-white p-5 shadow-sm md:col-span-3"><h3 className="text-xs font-black text-navy">조사 운영 정보</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="조사 시작" value={round.surveyOpensAt.toDate().toLocaleString('ko-KR')} /><Info label="조사 마감" value={round.surveyClosesAt.toDate().toLocaleString('ko-KR')} /><Info label="날짜별 면접 시간" value={formatDaySchedules(round.allowedSlots, round.availabilitySlotMinutes)} /><Info label="응답/배정 단위" value={`${round.availabilitySlotMinutes}분 / ${round.assignmentSlotMinutes}분`} /><Info label="조사 상태" value={getSurveyStatusLabel(round.surveyOpensAt.toDate(), round.surveyClosesAt.toDate())} /></dl></section></div>}

    {tab === 'applicants' && <section className="space-y-4"><div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-300" size={16} /><input value={logic.search} onChange={event => logic.setSearch(event.target.value)} className="w-full rounded-xl border border-slate-100 py-2 pl-9 pr-3 text-sm" placeholder="이름, 번호, 연락처 검색" /></div><div className="flex gap-2"><select aria-label="지원자 정렬 기준" value={sortKey} onChange={event => setSortKey(event.target.value as ApplicantSortKey)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-navy sm:w-48"><option value="applicantNumber">지원번호</option><option value="name">이름</option><option value="createdAt">등록 시각</option><option value="updatedAt">정보 수정 시각</option><option value="responseUpdatedAt">응답 수정 시각</option><option value="assignmentStartsAt">면접 시각</option>{applicationHeaders.map(header => <option key={header} value={`application:${header}`}>지원서 · {header}</option>)}</select><button aria-label={sortDirection === 'asc' ? '오름차순' : '내림차순'} title={sortDirection === 'asc' ? '오름차순' : '내림차순'} onClick={() => setSortDirection(current => current === 'asc' ? 'desc' : 'asc')} className="rounded-xl border border-slate-200 bg-white p-2.5 text-navy">{sortDirection === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}</button></div></div><div className="mt-3 flex gap-2 overflow-x-auto">{FILTERS.map(item => <button key={item.id} onClick={() => logic.setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold ${logic.filter === item.id ? 'bg-navy text-white' : 'bg-slate-50 text-slate-500'}`}>{item.label}</button>)}</div></div><div className="space-y-2">{sortedApplicants.map(applicant => <ApplicantRow key={applicant.id} applicant={applicant} onOpen={() => setDetailApplicantId(applicant.id)} onEdit={() => { setEditingApplicantId(applicant.id); setApplicantFormOpen(true); }} onArchive={() => { const archived = (applicant.lifecycle ?? 'active') !== 'archived'; const warning = applicant.assignment ? '\n현재 면접 일정은 기록으로 유지되고 개인 링크가 비활성화됩니다.' : ''; if (window.confirm(`${applicant.name} 지원자를 ${archived ? '보관' : '복원'}할까요?${warning}`)) void logic.archiveApplicant(applicant, archived); }} onWithdraw={() => { const withdrawn = (applicant.applicationStatus ?? 'active') !== 'withdrawn'; const warning = withdrawn ? '\n개인 링크가 차단되고 현재 활성 배정은 이력으로 남긴 뒤 해제됩니다.' : '\n기존 배정은 자동 복원되지 않습니다.'; if (window.confirm(`${applicant.name} 지원자를 ${withdrawn ? '지원 철회' : '정상 상태로 복구'}할까요?${warning}`)) void logic.setApplicantWithdrawn(applicant.id, withdrawn); }} onReset={() => { if (window.confirm(`${applicant.name} 지원자의 최초 접속·가능시간·현재 배정을 초기화할까요? 지원서와 면접 기록은 보존됩니다.`)) void logic.resetApplicantSchedule(applicant.id); }} />)}</div></section>}

    {tab === 'interviewers' && <InterviewersPanel round={round} interviewers={logic.interviewers} applicants={logic.applicants} onAdd={logic.addInterviewer} onSaveAvailability={logic.saveInterviewerAvailability} onRemove={logic.removeInterviewer} />}

    {tab === 'schedule' && <InterviewSchedulePanel round={round} applicants={logic.applicants} interviewers={logic.interviewers} changeRequests={logic.changeRequests} draft={logic.autoDraft} onDraftChange={logic.setAutoDraft} onRunApplicantAutoAssignment={applicantId => { logic.runAutoAssignment('applicant', applicantId); }} onApplyDraft={logic.applyAutoDraft} onAssign={logic.assignApplicant} onClearAssignment={logic.clearAssignment} onChangeAssignmentState={logic.changeAssignmentState} onResetSchedule={logic.resetApplicantSchedule} />}

    {tab === 'progress' && <InterviewerDashboard round={round} interviewers={logic.interviewers} applicants={logic.applicants} changeRequests={logic.changeRequests} onComplete={logic.completeApplicantInterview} onActionNeeded={logic.markActionNeeded} onRestoreScheduled={logic.restoreScheduled} onResetSchedule={logic.resetApplicantSchedule} onResolveRequest={logic.resolveChangeRequest} />}

    {tab === 'selection' && <SelectionPanel round={round} applicants={logic.applicants} onUpdateOverallRating={logic.updateCompletedRating} onUpdateSelectionStatus={logic.updateSelectionStatus} onReopenCompletedInterview={logic.reopenCompletedInterview} />}

    {tab === 'settings' && <section className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black text-navy">회차 설정</h3><p className="mt-1 text-sm text-slate-500">조사 기간, 면접 날짜, 시간 범위, 슬롯 단위, 메시지 템플릿을 관리합니다.</p><p className="mt-2 text-xs font-bold text-amber-600">일정 변경 시 기존 응답에 포함된 무효 슬롯을 미리 계산하고 확인 후 일괄 정리합니다.</p></div><button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white"><Settings size={15} />설정 변경</button></div></section>}

    <ApplicantCsvImportModal open={importOpen} onClose={() => setImportOpen(false)} onConfirm={logic.importRows} getMergePreview={logic.previewImportRows} />
    <ApplicantFormModal open={applicantFormOpen} applicant={logic.applicants.find(item => item.id === editingApplicantId) ?? null} onClose={() => setApplicantFormOpen(false)} onSave={draft => {
      const applicant = logic.applicants.find(item => item.id === editingApplicantId);
      return applicant ? logic.editApplicant(applicant, draft) : logic.addApplicant(draft);
    }} />
    <ApplicantDetailModal applicant={detailApplicant} round={round} onClose={() => setDetailApplicantId(null)} onMarkSent={(kind, markedSent) => detailApplicant ? logic.markSent(detailApplicant.id, kind, markedSent) : Promise.resolve()} />
    <InterviewRoundFormModal open={settingsOpen} round={round} onClose={() => setSettingsOpen(false)} onSave={applySettings} />
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'navy' | 'green' | 'gold' }) { const styles = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'gold' ? 'bg-amber-50 text-amber-700' : 'bg-white text-navy'; return <div className={`rounded-3xl p-5 shadow-sm ${styles}`}><p className="text-[10px] font-bold uppercase opacity-60">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-700">{value}</dd></div>; }
function ApplicantRow({ applicant, onOpen, onEdit, onArchive, onWithdraw, onReset }: { applicant: InterviewApplicantWithAccess; onOpen: () => void; onEdit: () => void; onArchive: () => void; onWithdraw: () => void; onReset: () => void }) {
  const withdrawn = (applicant.applicationStatus ?? 'active') === 'withdrawn';
  const journey = getApplicantJourney(applicant, applicant.assignment ? formatAssignment(applicant) : '');
  return <article className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:bg-indigo-50 xl:flex-row xl:items-center">
    <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left xl:w-[210px] xl:shrink-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-navy"><Users size={16} /></span><span className="min-w-0"><span className="block truncate font-black text-navy">{applicant.name} <span className="text-xs font-normal text-slate-400">{applicant.applicantNumber}</span></span><span className="block text-[11px] text-slate-400">{applicant.phone}</span></span></button>
    <ApplicantJourney model={journey} />
    <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end"><button type="button" onClick={onEdit} className="rounded-xl bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-navy">수정</button><button type="button" onClick={onWithdraw} title={withdrawn ? '지원 철회 취소' : '지원 철회'} aria-label={withdrawn ? '지원 철회 취소' : '지원 철회'} className={`rounded-xl p-2.5 ${withdrawn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}><UserMinus size={14} /></button><button type="button" disabled={withdrawn} onClick={onReset} title={withdrawn ? '철회 취소 후 일정 초기화 가능' : '일정 초기화'} aria-label={withdrawn ? '철회 취소 후 일정 초기화 가능' : '일정 초기화'} className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"><RotateCcw size={14} /></button><button type="button" onClick={onArchive} title={(applicant.lifecycle ?? 'active') === 'archived' ? '복원' : '보관'} aria-label={(applicant.lifecycle ?? 'active') === 'archived' ? '보관 복원' : '보관'} className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Archive size={14} /></button><button type="button" disabled={withdrawn} onClick={() => navigator.clipboard.writeText(applicant.link).then(() => toast.success('링크를 복사했습니다.')).catch(() => toast.error('링크를 복사하지 못했습니다.'))} title={withdrawn ? '지원 철회로 링크가 비활성화됨' : '개인 링크 복사'} aria-label={withdrawn ? '지원 철회로 링크가 비활성화됨' : '개인 링크 복사'} className="rounded-xl bg-slate-100 p-2.5 text-slate-500 disabled:opacity-35"><Copy size={14} /></button><button type="button" onClick={onOpen} className="flex items-center gap-1 rounded-xl bg-navy px-3 py-2 text-[11px] font-bold text-white"><MessageSquare size={14} />문자</button></div>
  </article>;
}
