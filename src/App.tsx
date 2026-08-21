import React, { Component, useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout, testConnection, checkAdminStatus } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Users, Dices, FileSpreadsheet, History, ChevronRight, PlayCircle, Settings, BarChart, CalendarClock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoredSessionGroup } from './types';
import { Routes, Route, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';

import { Toaster, toast } from 'sonner';

import AvalonLogo from './components/AvalonLogo';
import Sidebar from './components/Sidebar';
import LoginGate from './components/LoginGate';

// Route-level chunks keep infrequently visited screens out of the initial download.
const MembersPage = React.lazy(() => import('./components/MembersPage'));
const GamesPage = React.lazy(() => import('./components/GamesPage'));
const AttendancePage = React.lazy(() => import('./components/AttendancePage'));
const SessionsPage = React.lazy(() => import('./components/SessionsPage'));
const MeetingProgressPage = React.lazy(() => import('./components/MeetingProgressPage'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));
const ArchivePage = React.lazy(() => import('./components/ArchivePage'));
const InterviewRoundsPage = React.lazy(() => import('./components/InterviewRoundsPage'));
const InterviewRoundPage = React.lazy(() => import('./components/InterviewRoundPage'));
const PublicInterviewPage = React.lazy(() => import('./components/PublicInterviewPage'));

function RouteLoadingFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-white text-xs font-mono uppercase tracking-widest text-slate-400">화면을 불러오는 중...</div>;
}

const PrivateRoute = ({ user, isAdmin, children }: { user: User | null; isAdmin: boolean; children: React.ReactNode }) => {
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
  onRecover: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

/** Keeps an unexpected route error from taking the entire administration UI white. */
class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    console.error('Route rendering failed.', error);
  }

  render() {
    if (this.state.hasError) {
      return <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <h2 className="text-lg font-black text-navy">화면을 열지 못했습니다.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">다른 메뉴는 계속 사용할 수 있습니다. 면접 회차 목록으로 돌아간 뒤 다시 열어주세요.</p>
        <button type="button" onClick={this.props.onRecover} className="mt-5 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white">면접 회차 목록으로</button>
      </div>;
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);
  const [isAdminModeActive, setIsAdminModeActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        setLoginError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoggingIn(false);
    }
  };
  const [draftSession, setDraftSession] = useState<{ name: string, date: string, groups: StoredSessionGroup[] } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/meeting') {
      setIsSidebarCollapsed(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/interview/')) {
      testConnection();
    }
    
    const handleAdminModeToggle = () => {
      setIsAdminModeActive(prev => {
        const next = !prev;
        if (next) {
          toast.success('관리자 모드가 활성화되었습니다.');
        } else {
          toast.success('관리자 모드가 비활성화되었습니다.');
        }
        return next;
      });
    };
    window.addEventListener('avalon-admin-mode-toggle', handleAdminModeToggle);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        setLoading(true);
        const { isAdmin: adminStatus, isMaster: masterStatus } = await checkAdminStatus(u.email);
        setIsAdmin(adminStatus);
        setIsMasterAdmin(masterStatus);
      } else {
        setIsAdmin(false);
        setIsMasterAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('avalon-admin-mode-toggle', handleAdminModeToggle);
      unsubscribe();
    };
  }, []);

  const isPublicInterviewRoute = location.pathname.startsWith('/interview/');

  if (loading && !isPublicInterviewRoute) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="animate-pulse space-y-4 text-center">
          <div className="mx-auto flex w-12 items-center justify-center text-navy opacity-50">
            <AvalonLogo width="48" height="48" />
          </div>
          <p className="font-mono text-xs text-slate-400 uppercase tracking-widest">시스템 부팅 중...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'members', label: '동아리원 관리', icon: Users, category: 'Database', path: '/' },
    { id: 'games', label: '게임 라이브러리', icon: Dices, category: 'Database', path: '/games' },
    { id: 'attendance', label: '일일 조 편성', icon: FileSpreadsheet, category: 'Operations', path: '/attendance' },
    { id: 'meeting', label: '모임 진행 및 추천', icon: PlayCircle, category: 'Operations', path: '/meeting' },
    { id: 'sessions', label: '세션 기록', icon: History, category: 'Operations', path: '/sessions' },
    { id: 'archive', label: '통계 및 아카이브', icon: BarChart, category: 'Operations', path: '/archive' },
    { id: 'interviews', label: '신입부원 면접', icon: CalendarClock, category: 'Operations', path: '/interviews' },
  ];

  const currentTab = tabs.find(t => t.path === location.pathname || (t.path !== '/' && location.pathname.startsWith(`${t.path}/`))) || { label: '설정 및 내보내기' };

  const protectedLayout = (children: React.ReactNode) => (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-navy pb-16 md:pb-0">
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        user={user!}
        logout={logout}
        tabs={tabs}
      />

      {/* Content Area */}
      <main className="flex-1 overflow-auto flex flex-col w-full md:w-auto">
        <header className="h-14 md:h-16 bg-white border-b border-slate-100 md:border-transparent px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-widest">
            <span>Admin</span>
            <ChevronRight size={12} />
            <span className="text-slate-900 font-bold">{currentTab.label}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-[11px] font-mono text-slate-400 md:block">
              System Status: <span className="text-emerald-500 font-bold">CONNECTED</span>
            </div>
            {isAdminModeActive && (
              <div aria-label="관리자 편집 모드 활성" className="flex h-8 items-center gap-2 rounded-lg bg-amber-50 px-2 text-navy sm:h-9 sm:px-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gold text-white sm:h-6 sm:w-6"><ShieldCheck size={14} /></span>
                <span className="text-[10px] font-black sm:hidden">관리 모드</span>
                <span className="hidden flex-col leading-tight sm:flex"><span className="text-[11px] font-black">편집 가능</span><span className="text-[9px] font-bold text-slate-400">관리자 모드 활성</span></span>
              </div>
            )}
            <Link
               to="/settings"
               className={`p-2 rounded-lg transition-colors ${location.pathname === '/settings' ? 'bg-slate-100 text-navy' : 'text-slate-400 hover:text-navy hover:bg-slate-100'}`}
            >
              <Settings size={18} />
            </Link>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-12 grow">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <RouteErrorBoundary resetKey={location.pathname} onRecover={() => navigate('/interviews')}>
                {children}
              </RouteErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );

  return (
    <>
      <Toaster position="bottom-right" />
      <React.Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route path="/" element={
        !user || !isAdmin ? (
          <LoginGate
            user={user}
            isAdmin={isAdmin}
            loggingIn={loggingIn}
            loginError={loginError}
            handleLogin={handleLogin}
            logout={logout}
          />
        ) : (
          protectedLayout(<MembersPage isAdminModeActive={isAdminModeActive} />)
        )
      } />
      <Route path="/games" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<GamesPage isAdminModeActive={isAdminModeActive} />)}
        </PrivateRoute>
      } />
      <Route path="/attendance" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<AttendancePage onMoveToRecord={(draft) => { setDraftSession(draft); navigate('/meeting'); }} isAdminModeActive={isAdminModeActive} />)}
        </PrivateRoute>
      } />
      <Route path="/meeting" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<MeetingProgressPage onSidebarToggle={(collapsed) => setIsSidebarCollapsed(collapsed)} />)}
        </PrivateRoute>
      } />
      <Route path="/sessions" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<SessionsPage draftSession={draftSession} onClearDraft={() => setDraftSession(null)} isAdminModeActive={isAdminModeActive} />)}
        </PrivateRoute>
      } />
      <Route path="/archive" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<ArchivePage />)}
        </PrivateRoute>
      } />
      <Route path="/interviews" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<InterviewRoundsPage />)}
        </PrivateRoute>
      } />
      <Route path="/interviews/:roundId" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<InterviewRoundPage isAdminModeActive={isAdminModeActive} />)}
        </PrivateRoute>
      } />
      <Route path="/interview/:token" element={<PublicInterviewPage />} />
      <Route path="/settings" element={
        <PrivateRoute user={user} isAdmin={isAdmin}>
          {protectedLayout(<SettingsPage isAdminModeActive={isAdminModeActive} setIsAdminModeActive={setIsAdminModeActive} isMasterAdmin={isMasterAdmin} />)}
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
    </>
  );
}
