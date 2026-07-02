import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import AvalonLogo from './AvalonLogo';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (c: boolean) => void;
  user: User;
  logout: () => Promise<void>;
  tabs: { id: string, label: string, icon: React.ElementType, category: string, path: string }[];
}

export default function Sidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  user,
  logout,
  tabs
}: SidebarProps) {
  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-50 md:sticky md:top-0 md:bottom-auto
      flex flex-row md:flex-col justify-around px-2 py-2 md:justify-between md:py-0 md:px-0
      bg-white md:bg-white border-t md:border-r border-slate-100 transition-all duration-300 ease-in-out shrink-0 
      ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
      h-16 md:h-screen overflow-x-auto overflow-y-hidden md:overflow-visible
    `}>
      <div className={`p-0 md:p-4 md:overflow-hidden flex md:block w-full md:w-auto`}>
        <div className={`hidden md:flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-10 px-2 mt-2`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 shrink-0">
              <AvalonLogo width="32" height="32" />
              <h2 className="text-xl font-bold tracking-tight text-slate-800">AVALON</h2>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 text-slate-400 hover:text-navy hover:bg-slate-100 rounded-lg shrink-0 transition-colors">
             {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        
        <div className="flex flex-row md:flex-col md:space-y-6 w-full justify-between md:justify-start">
          {['Database', 'Operations'].map(cat => (
            <div key={cat} className="flex flex-row md:flex-col w-full md:w-auto flex-1 md:flex-none">
              <div className="hidden md:block">
                {!isSidebarCollapsed && (
                  <div className="px-4 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest overflow-hidden whitespace-nowrap">
                    {cat === 'Database' ? '데이터베이스' : '운영 관리'}
                  </div>
                )}
                {isSidebarCollapsed && (
                  <div className="h-6 flex align-center justify-center text-[10px] uppercase font-bold text-slate-300 tracking-wider mb-2">
                    {cat === 'Database' ? 'DB' : 'OPS'}
                  </div>
                )}
              </div>
              <div className="flex flex-row md:flex-col w-full md:w-auto md:space-y-1">
                {tabs.filter(t => t.category === cat).map(tab => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={({ isActive }) => `flex-1 md:flex-none md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start py-2 md:py-3 px-1 md:px-6 rounded-xl md:rounded-xl text-xs sm:text-sm font-bold transition-all 
                      ${isActive ? 'text-navy md:bg-navy md:text-white md:shadow-md' : 'text-slate-400 md:text-slate-500 hover:md:bg-gold hover:md:text-white hover:text-gold'} 
                      ${isSidebarCollapsed ? 'md:justify-center md:px-0' : ''}`}
                    title={isSidebarCollapsed || typeof window !== 'undefined' && window.innerWidth < 768 ? tab.label : ''}
                  >
                    {({ isActive }) => (
                      <>
                        <tab.icon size={window.innerWidth < 768 ? 20 : 18} className="shrink-0 mb-1 md:mb-0" />
                        <span className={`hidden md:inline md:text-sm ${isActive ? 'font-black' : 'font-medium md:font-bold'} md:ml-3 md:truncate ${isSidebarCollapsed ? '!hidden' : 'block'}`}>
                          {tab.label}
                        </span>
                        <span className={`md:hidden text-[9px] ${isActive ? 'font-black' : 'font-medium'} ${isSidebarCollapsed ? 'hidden' : 'block'} mt-1 text-center`}>
                          {tab.label.split(' ')[0]}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden md:block p-4 bg-slate-100/50 border-t border-transparent">
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} mb-4 p-2 bg-white rounded-xl`} title={isSidebarCollapsed ? user.displayName || user.email || '' : ''}>
          <img src={user.photoURL || ''} alt="" className={`w-8 h-8 rounded-lg shadow-sm shrink-0 ${isSidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`} />
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          )}
        </div>
        <button 
          onClick={logout}
          className={`w-full flex items-center justify-center ${isSidebarCollapsed ? '' : 'gap-2'} p-2.5 bg-white text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all text-xs font-bold`}
          title={isSidebarCollapsed ? '로그아웃' : ''}
        >
          <LogOut size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>로그아웃</span>}
        </button>
      </div>
    </nav>
  );
}
