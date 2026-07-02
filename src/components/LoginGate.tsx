import React from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import AvalonLogo from './AvalonLogo';
import { User } from 'firebase/auth';

interface LoginGateProps {
  user: User | null;
  isAdmin: boolean;
  loggingIn: boolean;
  loginError: string | null;
  handleLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

export default function LoginGate({
  user,
  isAdmin,
  loggingIn,
  loginError,
  handleLogin,
  logout
}: LoginGateProps) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-panel p-12 text-center space-y-8 bg-white border-transparent"
      >
        <div className="space-y-3">
          <div className="mx-auto flex w-16 items-center justify-center">
            <AvalonLogo width="64" height="64" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">AVALON</h1>
          <p className="text-sm text-slate-500 font-medium">동아리 관리 통합 터미널</p>
        </div>
        
        {user && !isAdmin ? (
          <div className="space-y-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100">
              접근 권한이 없습니다.<br/>
              <span className="text-xs font-normal opacity-80 mt-1 block">{user.email}</span>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shadow-sm font-bold"
            >
              <LogOut size={20} />
              <span>계정 로그아웃</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              disabled={loggingIn}
              className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl transition-all shadow-lg font-bold ${loggingIn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-navy hover:bg-gold text-white shadow-sm'}`}
            >
              {loggingIn ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <ShieldCheck size={20} />
              )}
              <span>{loggingIn ? '접속 시도 중...' : 'Google 계정으로 접속'}</span>
            </button>
            
            {loginError && (
              <p className="text-[10px] text-red-500 font-bold bg-red-50 py-2 px-3 rounded-lg border border-red-100">
                {loginError}
              </p>
            )}
          </div>
        )}
        
        <p className="text-xs text-slate-400 font-medium">관리자 권한이 필요합니다.</p>
      </motion.div>
    </div>
  );
}
