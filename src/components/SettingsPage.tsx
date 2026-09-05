import React from 'react';
import { useSettingsAdmins } from '../hooks/useSettingsAdmins';
import { useClubExports } from '../hooks/useClubExports';
import SettingsAdminPanel from './SettingsAdminPanel';
import SettingsExportPanel from './SettingsExportPanel';
import SettingsAuditPanel from './SettingsAuditPanel';

export default function SettingsPage({
  isAdminModeActive,
  setIsAdminModeActive,
  isMasterAdmin,
}: {
  isAdminModeActive: boolean;
  setIsAdminModeActive: (active: boolean) => void;
  isMasterAdmin: boolean;
}) {
  const adminSettings = useSettingsAdmins();
  const clubExports = useClubExports();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">설정 및 내보내기</h1>
        <p className="text-xs text-slate-400 font-mono uppercase mt-1">System / Settings & Export</p>
      </div>

      {isMasterAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">관리자 편집 모드</h2>
              <p className="text-sm text-slate-500 mt-1">
                동아리원, 게임 라이브러리, 세션 기록 등의 데이터를 수정하거나 삭제할 수 있는 권한을 활성화합니다.
                비활성화 시 읽기 전용으로 표시됩니다.
              </p>
            </div>
            <button
              onClick={() => setIsAdminModeActive(!isAdminModeActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isAdminModeActive ? 'bg-navy' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAdminModeActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <SettingsAdminPanel isMasterAdmin={isMasterAdmin} {...adminSettings} />
      {isMasterAdmin && isAdminModeActive && <SettingsAuditPanel />}
      <SettingsExportPanel {...clubExports} />
    </div>
  );
}
