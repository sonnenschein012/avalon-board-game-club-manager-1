import { useState } from 'react';
import { CalendarClock, ChevronRight, ClipboardList, FlaskConical, ShieldCheck, Users } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AttendanceScenario, InterviewScenario, MembersScenario } from './ScenarioPages';
import type { AttendanceScenarioState, InterviewScenarioState, MembersScenarioState } from './fixtures';

export const SCENARIO_LAB_SENTINEL = 'AVALON_SCENARIO_LAB';

const pageDefinitions = {
  members: {
    label: '동아리원 관리',
    states: ['default', 'empty', 'crowded', 'long-names'],
    stateLabels: { default: '기본', empty: '빈 목록', crowded: '48명', 'long-names': '긴 이름' },
  },
  interview: {
    label: '신입부원 면접',
    states: ['default', 'mobile-heavy', 'change-needed'],
    stateLabels: { default: '기본', 'mobile-heavy': '지원자 많음', 'change-needed': '변경 요청' },
  },
  attendance: {
    label: '일일 조 편성',
    states: ['default', 'empty', 'crowded'],
    stateLabels: { default: '기본', empty: '빈 명단', crowded: '혼잡' },
  },
} as const;

type ScenarioPage = keyof typeof pageDefinitions;
type ViewportWidth = '390' | '768' | '1440';

const tabs = [
  { id: 'members', label: '동아리원 관리', icon: Users, category: 'Database', path: '/members/default' },
  { id: 'attendance', label: '일일 조 편성', icon: ClipboardList, category: 'Operations', path: '/attendance/default' },
  { id: 'interview', label: '신입부원 면접', icon: CalendarClock, category: 'Operations', path: '/interview/default' },
];

const scenarioUser = {
  displayName: 'Avalon Design Tester',
  email: 'avalon-design-tester@scenario.invalid',
  photoURL: null,
};

function isScenarioPage(value: string | undefined): value is ScenarioPage {
  return Boolean(value && value in pageDefinitions);
}

function ScenarioContent({ page, state }: { page: ScenarioPage; state: string }) {
  if (page === 'members') return <MembersScenario state={state as MembersScenarioState} />;
  if (page === 'interview') return <InterviewScenario state={state as InterviewScenarioState} />;
  return <AttendanceScenario state={state as AttendanceScenarioState} />;
}

function ScenarioShell({ page, state }: { page: ScenarioPage; state: string }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  return <div className="flex min-h-screen flex-col bg-white pb-16 text-navy md:flex-row md:pb-0" data-scenario-sentinel={SCENARIO_LAB_SENTINEL}>
    <Sidebar
      isSidebarCollapsed={isSidebarCollapsed}
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      user={scenarioUser}
      logout={async () => undefined}
      tabs={tabs}
    />
    <main className="flex w-full flex-1 flex-col overflow-auto md:w-auto">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 md:h-16 md:border-transparent md:px-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
          <span>Scenario</span><ChevronRight size={12} />
          <span className="font-bold text-slate-900">{pageDefinitions[page].label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg bg-violet-50 px-2 py-1 font-mono text-[10px] font-bold text-violet-700 sm:inline">LOCAL FIXTURE</span>
          <div aria-label="가짜 master 사용자" className="flex h-9 items-center gap-2 rounded-lg bg-amber-50 px-2.5 text-navy">
            <ShieldCheck size={15} className="text-gold" /><span className="text-[10px] font-black">master</span>
          </div>
        </div>
      </header>
      <div className="grow p-4 sm:p-6 md:p-12"><ScenarioContent page={page} state={state} /></div>
    </main>
  </div>;
}

function ScenarioRoute() {
  const { page: pageParam, state: stateParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  if (!isScenarioPage(pageParam)) return <Navigate to="/members/default" replace />;
  const definition = pageDefinitions[pageParam];
  const state = definition.states.includes(stateParam as never) ? stateParam! : definition.states[0];
  if (state !== stateParam) return <Navigate to={`/${pageParam}/${state}`} replace />;

  const query = new URLSearchParams(location.search);
  const embedded = query.get('embed') === '1';
  const requestedViewport = query.get('viewport');
  const viewport: ViewportWidth = requestedViewport === '390' || requestedViewport === '768' || requestedViewport === '1440'
    ? requestedViewport
    : '1440';

  if (embedded) return <ScenarioShell page={pageParam} state={state} />;

  const navigateTo = (nextPage: ScenarioPage, nextState: string, nextViewport = viewport) => {
    navigate(`/${nextPage}/${nextState}?viewport=${nextViewport}`);
  };
  const previewUrl = `/design.html#/${pageParam}/${state}?embed=1`;

  return <div className="min-h-screen bg-slate-100" data-testid="scenario-lab-controls">
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1540px] flex-wrap items-center gap-3">
        <div className="mr-2 flex items-center gap-2 text-sm font-black text-navy"><FlaskConical size={18} className="text-violet-600" />Scenario Lab</div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">Page
          <select aria-label="Scenario page" value={pageParam} onChange={event => {
            const nextPage = event.target.value as ScenarioPage;
            navigateTo(nextPage, pageDefinitions[nextPage].states[0]);
          }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-navy">
            {Object.entries(pageDefinitions).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">State
          <select aria-label="Scenario state" value={state} onChange={event => navigateTo(pageParam, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-navy">
            {definition.states.map(option => <option key={option} value={option}>{(definition.stateLabels as Record<string, string>)[option]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">Viewport
          <select aria-label="Scenario viewport" value={viewport} onChange={event => navigateTo(pageParam, state, event.target.value as ViewportWidth)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-navy">
            <option value="390">Mobile · 390px</option>
            <option value="768">Tablet · 768px</option>
            <option value="1440">Desktop · 1440px</option>
          </select>
        </label>
        <span className="ml-auto hidden font-mono text-[10px] text-slate-400 lg:inline">{`/design.html#/${pageParam}/${state}`}</span>
      </div>
    </div>
    <div className="overflow-auto p-4">
      <iframe
        key={previewUrl}
        title="Scenario preview"
        src={previewUrl}
        style={{ width: `${viewport}px`, height: 'calc(100vh - 104px)' }}
        className="mx-auto block min-h-[640px] max-w-none rounded-xl border border-slate-300 bg-white shadow-xl"
      />
    </div>
  </div>;
}

export default function ScenarioLabApp() {
  return <Routes>
    <Route path="/:page/:state" element={<ScenarioRoute />} />
    <Route path="*" element={<Navigate to="/members/default" replace />} />
  </Routes>;
}
