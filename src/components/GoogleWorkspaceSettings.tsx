import React, { useState, useEffect } from 'react';
import type {
  GoogleConnectionPublicInfo,
  CurrentSheetSourceInfo,
  SpreadsheetMetadata,
} from '../types/googleWorkspace';
import { useGoogleWorkspace } from '../hooks/useGoogleWorkspace';
import { openGooglePicker } from '../lib/googlePicker';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import SheetTabSelectModal from './SheetTabSelectModal';
import {
  CheckCircle2,
  AlertCircle,
  Link2Off,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  UserCheck,
  LogOut,
  ExternalLink,
  Shield,
  Loader2,
} from 'lucide-react';

export interface GoogleWorkspaceSettingsProps {
  userRole?: 'admin' | 'master';
}

export function getGoogleWorkspacePermissions(userRole: 'admin' | 'master' = 'admin') {
  const isMaster = userRole === 'master';
  return {
    canViewPublicStatus: true,
    canSelectSheetSource: true,
    canChangeFormTemplate: isMaster,
    canManageGoogleAccount: isMaster,
  };
}

export default function GoogleWorkspaceSettings({
  userRole = 'admin',
}: GoogleWorkspaceSettingsProps) {
  const isMaster = userRole === 'master';
  const {
    handleRequestAuthUrl,
    handleSetFormTemplate,
    handleInspectSheet,
    handleSaveSheetSource,
    handleDisconnect: executeDisconnect,
  } = useGoogleWorkspace();

  const [connectionInfo, setConnectionInfo] = useState<GoogleConnectionPublicInfo>({
    state: 'disconnected',
    connectedEmail: null,
  });
  const [currentSource, setCurrentSource] = useState<CurrentSheetSourceInfo | null>(null);
  const [, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab Selection Modal state
  const [tabModalOpen, setTabModalOpen] = useState(false);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetMetadata | null>(null);

  // Disconnect Confirmation Modal
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  // Real-time listener for public settings
  useEffect(() => {
    const publicDocRef = doc(db, 'system_settings', 'google_workspace_public');
    const sourceDocRef = doc(db, 'system_settings', 'current_meeting_source');

    const unsubPublic = onSnapshot(
      publicDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConnectionInfo({
            state: data.state || 'disconnected',
            connectedEmail: data.connectedEmail || null,
            connectedAt: data.connectedAt,
            templateFormId: data.templateFormId,
            templateFormTitle: data.templateFormTitle,
            lastVerifiedAt: data.lastVerifiedAt,
          });
        } else {
          setConnectionInfo({
            state: 'disconnected',
            connectedEmail: null,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to google workspace public status:', error);
        setLoading(false);
      }
    );

    const unsubSource = onSnapshot(
      sourceDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCurrentSource({
            sourceType: (data.sourceType as CurrentSheetSourceInfo['sourceType']) || 'manual_sheet',
            spreadsheetId: data.spreadsheetId,
            spreadsheetTitle: data.spreadsheetTitle,
            sheetId: data.sheetId ?? 0,
            tabTitle: data.tabTitle || 'Sheet1',
            selectedAt: data.selectedAt,
            selectedBy: data.selectedBy,
            surveyId: data.surveyId,
          });
        } else {
          setCurrentSource(null);
        }
      },
      (error) => {
        console.error('Failed to subscribe to current meeting source:', error);
      }
    );

    return () => {
      unsubPublic();
      unsubSource();
    };
  }, []);

  // Connect / Reconnect / Change Account
  const handleConnectOrReconnect = async (mode: 'connect' | 'reconnect' | 'change') => {
    if (!isMaster) return;

    try {
      setActionLoading(true);
      const res = await handleRequestAuthUrl(mode);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        toast.error('Google 인증 페이지를 열 수 없습니다.');
        setActionLoading(false);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Google 인증 URL 요청에 실패했습니다.';
      toast.error(errorMsg);
      setActionLoading(false);
    }
  };

  // Form Template Picker (Master Admin only)
  const handleSelectFormTemplate = async () => {
    if (!isMaster) {
      toast.error('설문 템플릿 변경은 Master Admin만 가능합니다.');
      return;
    }

    try {
      setActionLoading(true);
      const picked = await openGooglePicker({ type: 'form' });
      if (!picked || !picked.id) {
        setActionLoading(false);
        return;
      }

      toast.info(`템플릿 확인 중: ${picked.name}...`);
      const res = await handleSetFormTemplate(picked.id);
      toast.success(`설문 템플릿이 설정되었습니다: ${res.title || picked.name}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '설문 템플릿 설정에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Spreadsheet Picker (All Admins)
  const handleSelectSpreadsheet = async () => {
    try {
      setActionLoading(true);
      const picked = await openGooglePicker({ type: 'spreadsheet' });
      if (!picked || !picked.id) {
        setActionLoading(false);
        return;
      }

      toast.info(`스프레드시트 탭 분석 중: ${picked.name}...`);
      const metadata = await handleInspectSheet(picked.id);

      if (!metadata.tabs || metadata.tabs.length === 0) {
        toast.error('선택한 스프레드시트에 유효한 탭이 없습니다.');
        return;
      }

      setSelectedSpreadsheet(metadata);
      setTabModalOpen(true);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '스프레드시트 확인에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Tab Selection
  const handleConfirmTab = async (sheetId: number, tabTitle: string) => {
    if (!selectedSpreadsheet) return;

    try {
      setActionLoading(true);
      await handleSaveSheetSource({
        sourceType: 'manual_sheet',
        spreadsheetId: selectedSpreadsheet.id,
        spreadsheetTitle: selectedSpreadsheet.title,
        sheetId,
        tabTitle,
        selectedAt: new Date().toISOString(),
      });
      toast.success(`출석부 시트가 설정되었습니다: [${selectedSpreadsheet.title}] > ${tabTitle}`);
      setTabModalOpen(false);
      setSelectedSpreadsheet(null);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '시트 소스 저장에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect Google Account (Master Admin only)
  const handleDisconnect = async () => {
    if (!isMaster) return;

    try {
      setActionLoading(true);
      await executeDisconnect();
      toast.success('Google 계정 연동이 해제되었습니다.');
      setDisconnectModalOpen(false);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '연동 해제 중 오류가 발생했습니다.';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Connection Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Google Workspace 연동 상태</h3>
              <p className="text-xs text-gray-500">Google Forms 및 Sheets 출석부 연동 관리</p>
            </div>
          </div>

          <div>
            {connectionInfo.state === 'connected' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                연결됨
              </span>
            )}
            {connectionInfo.state === 'reauth_required' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                재인증 필요
              </span>
            )}
            {connectionInfo.state === 'disconnected' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                <Link2Off className="w-3.5 h-3.5 mr-1" />
                미연결
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block text-xs mb-0.5">연결된 Google 계정</span>
            <span className="font-medium text-gray-900">
              {connectionInfo.connectedEmail || '연결된 계정 없음'}
            </span>
          </div>

          <div>
            <span className="text-gray-500 block text-xs mb-0.5">최근 토큰 검증 시각</span>
            <span className="font-medium text-gray-900">
              {connectionInfo.lastVerifiedAt
                ? new Date(connectionInfo.lastVerifiedAt).toLocaleString()
                : '-'}
            </span>
          </div>
        </div>

        {/* Master Admin Account Action Buttons */}
        {isMaster && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
            {connectionInfo.state === 'disconnected' && (
              <button
                type="button"
                onClick={() => handleConnectOrReconnect('connect')}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1.5" />}
                Google 계정 연결
              </button>
            )}

            {connectionInfo.state === 'reauth_required' && (
              <>
                <button
                  type="button"
                  onClick={() => handleConnectOrReconnect('reconnect')}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center shadow-sm"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                  Google 계정 재인증 (다시 연결)
                </button>
                <button
                  type="button"
                  onClick={() => setDisconnectModalOpen(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50 flex items-center"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  연동 해제
                </button>
              </>
            )}

            {connectionInfo.state === 'connected' && (
              <>
                <button
                  type="button"
                  onClick={() => handleConnectOrReconnect('change')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {actionLoading ? '요청 중...' : '계정 변경'}
                </button>
                <button
                  type="button"
                  onClick={() => setDisconnectModalOpen(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50 flex items-center"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  연동 해제
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Current Attendance Sheet Source Card (All Admins can change) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">현재 출석부 Google Sheet 소스</h3>
              <p className="text-xs text-gray-500">조편성에 사용할 Google Sheet 출석부 지정</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectSpreadsheet}
            disabled={actionLoading}
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50 flex items-center"
          >
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            다른 Sheet 선택
          </button>
        </div>

        <div className="mt-4">
          {currentSource ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Spreadsheet</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                  {currentSource.sourceType === 'manual_sheet' ? '수동 지정 Sheet' : '자동 생성 Form Sheet'}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">{currentSource.spreadsheetTitle}</p>

              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  선택된 탭: <strong className="text-gray-800">{currentSource.tabTitle}</strong> (ID: {currentSource.sheetId})
                </span>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${currentSource.spreadsheetId}/edit#gid=${currentSource.sheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 inline-flex items-center font-medium"
                >
                  시트 열기 <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-1 text-gray-300" />
              <p className="text-xs">현재 설정된 Google Sheet 출석부가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-0.5">[다른 Sheet 선택]을 눌러 출석부를 지정해주세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Form Template Card (Master Admin can edit, All Admins can view) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Google Form 템플릿</h3>
              <p className="text-xs text-gray-500">자동 설문 생성에 사용할 기본 Form 템플릿</p>
            </div>
          </div>

          {isMaster && (
            <button
              type="button"
              onClick={handleSelectFormTemplate}
              disabled={actionLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition disabled:opacity-50 flex items-center"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              템플릿 변경
            </button>
          )}
        </div>

        <div className="mt-4">
          {connectionInfo.templateFormId ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200/80 space-y-2">
              <span className="text-xs font-semibold text-gray-500 block">설정된 템플릿</span>
              <p className="text-sm font-bold text-gray-900">
                {connectionInfo.templateFormTitle || '이름 없는 설문지'}
              </p>
              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                <span>Form ID: {connectionInfo.templateFormId}</span>
                <a
                  href={`https://docs.google.com/forms/d/${connectionInfo.templateFormId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 hover:text-purple-700 inline-flex items-center font-medium"
                >
                  설문지 열기 <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <FileText className="w-8 h-8 mx-auto mb-1 text-gray-300" />
              <p className="text-xs">설정된 Google Form 템플릿이 없습니다.</p>
              {isMaster && (
                <p className="text-xs text-purple-600 mt-0.5">[템플릿 변경]을 눌러 Form을 지정해주세요.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sheet Tab Selection Modal */}
      {selectedSpreadsheet && (
        <SheetTabSelectModal
          isOpen={tabModalOpen}
          spreadsheetTitle={selectedSpreadsheet.title}
          tabs={selectedSpreadsheet.tabs}
          defaultTabId={selectedSpreadsheet.defaultTabId}
          onSelect={(tab) => handleConfirmTab(tab.sheetId, tab.title)}
          onClose={() => {
            setTabModalOpen(false);
            setSelectedSpreadsheet(null);
          }}
        />
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-gray-900">Google 연동을 해제하시겠습니까?</h4>
              <p className="text-xs text-gray-500">
                연동을 해제하면 저장된 Google 토큰이 폐기되며, 다시 연결할 때까지 Sheet 동기화가 비활성화됩니다.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(false)}
                className="flex-1 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? '해제 중...' : '연동 해제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
