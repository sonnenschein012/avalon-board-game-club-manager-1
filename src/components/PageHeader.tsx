import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  stats?: {
    label: string;
    value: string | number;
  };
  actions?: React.ReactNode;
}

/**
 * 모든 페이지 상단에 공통으로 사용되는 헤더 컴포넌트입니다.
 */
export default function PageHeader({ title, subtitle, icon: Icon, stats, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={24} className="text-navy" />}
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-800">{title}</h1>
        </div>
        <p className="text-[10px] md:text-xs text-slate-400 font-mono uppercase">{subtitle}</p>
      </div>
      
      <div className="flex flex-wrap gap-4 items-center w-full md:w-auto justify-between md:justify-end">
        {stats && (
          <div className="text-left md:text-right pr-4 md:px-4 md:border-r border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">{stats.label}</p>
            <p className="text-lg md:text-xl font-black text-navy">{stats.value}</p>
          </div>
        )}
        <div className="flex-1 md:flex-none flex justify-end">
          {actions}
        </div>
      </div>
    </div>
  );
}
