import { useState } from 'react';
import { CalendarDays, ChevronRight, Loader2, Plus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from './PageHeader';
import InterviewRoundFormModal from './InterviewRoundFormModal';
import { useInterviewRoundsLogic } from '../hooks/useInterviewRoundsLogic';
import type { InterviewSchedule } from '../types';

function getSurveyStatus(opensAt: Date, closesAt: Date) {
  const now = Date.now();
  if (now < opensAt.getTime()) return { label: '조사 시작 전', collecting: false };
  if (now >= closesAt.getTime()) return { label: '조사 마감', collecting: false };
  return { label: '응답 수집 중', collecting: true };
}

function getRoundScheduleStatus(schedules: InterviewSchedule[]) {
  const active = schedules.filter(schedule => schedule.status !== 'archived');
  if (active.length === 0) return { label: '일정 추가 전', collecting: false, detail: '회차 안에서 면접 일정을 추가해주세요.' };
  const states = active.map(schedule => getSurveyStatus(schedule.surveyOpensAt.toDate(), schedule.surveyClosesAt.toDate()));
  const collecting = states.some(state => state.collecting);
  const hasUpcoming = active.some(schedule => Date.now() < schedule.surveyOpensAt.toDate().getTime());
  const label = collecting ? '응답 수집 중' : hasUpcoming ? '조사 시작 전' : '응답 마감';
  const futureCloses = active.map(schedule => schedule.surveyClosesAt.toDate()).filter(date => date.getTime() > Date.now()).sort((a, b) => a.getTime() - b.getTime());
  const closesAt = futureCloses[0] ?? active.map(schedule => schedule.surveyClosesAt.toDate()).sort((a, b) => b.getTime() - a.getTime())[0];
  return { label, collecting, detail: `면접 일정 ${active.length}개${closesAt ? ` · ${futureCloses.length ? '다음' : '마지막'} 마감 ${closesAt.toLocaleString('ko-KR')}` : ''}` };
}

export default function InterviewRoundsPage() {
  const { rounds, countsByRound, schedulesByRound, loading, saving, saveRound } = useInterviewRoundsLogic();
  const [modalOpen, setModalOpen] = useState(false);

  return <div className="space-y-6">
    <PageHeader title="신입부원 면접" subtitle="Operations / Interview Management" icon={CalendarDays} stats={{ label: '면접 회차', value: rounds.length }} actions={<button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white shadow-lg hover:bg-gold"><Plus size={16} />새 면접 회차</button>} />
    {loading ? <div className="flex justify-center py-24 text-slate-300"><Loader2 className="animate-spin" /></div> : rounds.length === 0 ? <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center"><CalendarDays className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">아직 생성된 면접 회차가 없습니다.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{rounds.map(round => {
      const counts = countsByRound[round.id] ?? { total: 0, responded: 0, pending: 0 };
      const surveyStatus = getRoundScheduleStatus(schedulesByRound[round.id] ?? []);
      return <article key={round.id} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:p-6">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${surveyStatus.collecting ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{surveyStatus.label}</span><h2 className="mt-3 truncate text-lg font-black text-navy">{round.name}</h2><p className="mt-1 text-xs text-slate-400">{surveyStatus.detail}</p></div></div>
        <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">지원자</p><p className="mt-1 text-xl font-black text-navy">{counts.total}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-600">응답</p><p className="mt-1 text-xl font-black text-emerald-700">{counts.responded}</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-600">미응답</p><p className="mt-1 text-xl font-black text-amber-700">{counts.pending}</p></div></div>
        <Link to={`/interviews/${round.id}`} className="mt-5 flex items-center justify-between rounded-xl bg-navy px-4 py-3 text-xs font-black text-white transition group-hover:bg-gold"><span className="flex items-center gap-2"><Users size={15} />회차 관리 및 설정</span><ChevronRight size={15} /></Link>
      </article>;
    })}</div>}
    <InterviewRoundFormModal open={modalOpen} saving={saving} onClose={() => setModalOpen(false)} onSave={saveRound} />
  </div>;
}
