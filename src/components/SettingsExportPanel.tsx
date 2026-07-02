import React from 'react';
import { Download, Loader2 } from 'lucide-react';

interface SettingsExportPanelProps {
  exportingMembers: boolean;
  exportMembers: () => Promise<void>;
  exportingGames: boolean;
  exportGames: () => Promise<void>;
  exportingSessions: boolean;
  exportSessions: () => Promise<void>;
}

export default function SettingsExportPanel({
  exportingMembers,
  exportMembers,
  exportingGames,
  exportGames,
  exportingSessions,
  exportSessions
}: SettingsExportPanelProps) {
  return (
    <div className="glass-panel p-6">
      <h2 className="text-lg font-bold text-navy mb-4 border-b border-slate-100 pb-2">데이터 내보내기 (Export)</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">동아리원 명부 (Members)</h3>
            <p className="text-xs text-slate-500 mt-1">멤버 기본 정보 및 누적 참석 횟수 포함</p>
          </div>
          <button
            onClick={exportMembers}
            disabled={exportingMembers}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-navy hover:text-navy text-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {exportingMembers ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            CSV 다운로드
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">게임 라이브러리 (Games)</h3>
            <p className="text-xs text-slate-500 mt-1">등록된 모든 보드게임 정보</p>
          </div>
          <button
            onClick={exportGames}
            disabled={exportingGames}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-navy hover:text-navy text-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {exportingGames ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            CSV 다운로드
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">모임 아카이브 (Sessions)</h3>
            <p className="text-xs text-slate-500 mt-1">날짜별 조 편성 및 플레이 기록</p>
          </div>
          <button
            onClick={exportSessions}
            disabled={exportingSessions}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-navy hover:text-navy text-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {exportingSessions ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
