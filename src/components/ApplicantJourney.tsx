import type { ApplicantJourneyModel } from '../domain/interviews/applicantJourney';
import { APPLICANT_JOURNEY_STATIONS } from '../domain/interviews/applicantJourney';

const BADGE_CLASS = {
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  muted: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
} as const;

export default function ApplicantJourney({ model }: { model: ApplicantJourneyModel }) {
  const completedRoute = model.completeAll;
  const completedLineWidth = completedRoute ? 80 : Math.max(0, model.currentIndex) * 20;
  const completedTextClass = completedRoute ? 'text-gold' : 'text-navy';
  const completedStationClass = completedRoute ? 'border-gold bg-gold' : 'border-navy bg-navy';
  return <div className="min-w-0 flex-1 py-1" aria-label="지원 절차 진행 상태">
    <ol className="relative grid grid-cols-5 gap-0" aria-label="지원 절차 진행 상태">
      <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[10px] h-[3px] rounded-full bg-slate-200" />
      <span aria-hidden="true" className={`absolute left-[10%] top-[10px] h-[3px] rounded-full transition-[width] duration-200 ${completedRoute ? 'bg-gold' : 'bg-navy'}`} style={{ width: `${completedLineWidth}%` }} />
      {APPLICANT_JOURNEY_STATIONS.map((station, index) => {
        const complete = index < model.currentIndex || (model.completeAll && index === model.currentIndex);
        const current = index === model.currentIndex && !model.completeAll;
        const status = complete ? '완료' : current ? '현재 단계' : '대기';
        return <li key={station.id} aria-current={current ? 'step' : undefined} aria-label={`${station.fullLabel}, ${status}`} className={`relative z-10 flex min-w-0 flex-col items-center gap-1.5 text-center text-[10px] font-bold ${complete ? completedTextClass : current ? 'text-gold' : 'text-slate-400'}`}>
          <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors duration-200 ${complete ? completedStationClass : current ? 'border-gold bg-white ring-4 ring-gold/15' : 'border-slate-300 bg-white'}`}><span className={`h-1.5 w-1.5 rounded-full ${complete ? 'bg-white' : current ? 'bg-gold' : 'bg-transparent'}`} /></span>
          <span className="whitespace-nowrap leading-none">{station.label}</span>
        </li>;
      })}
    </ol>
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-center gap-1.5"><p className="text-center text-[10px] font-bold text-slate-500">{model.detail}</p>{model.badges.map(badge => <span key={badge.label} className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${BADGE_CLASS[badge.tone]}`}>{badge.label}</span>)}</div>
  </div>;
}
