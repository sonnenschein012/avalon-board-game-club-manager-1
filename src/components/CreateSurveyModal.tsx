import React, { useState } from 'react';
import type { CreateDailySurveyResponse } from '../services/googleWorkspaceService';
import { useGoogleWorkspace } from '../hooks/useGoogleWorkspace';
import { toast } from 'sonner';
import {
  FileText,
  FileSpreadsheet,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface CreateSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: CreateDailySurveyResponse) => void;
  defaultTitle?: string;
}

export default function CreateSurveyModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTitle,
}: CreateSurveyModalProps) {
  const { handleCreateSurvey } = useGoogleWorkspace();
  const getInitialTitle = () => {
    if (defaultTitle) return defaultTitle;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} 정기모임 참석 조사`;
  };

  const [surveyTitle, setSurveyTitle] = useState(getInitialTitle);
  const [clientRequestId] = useState(() => `req_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [loading, setLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState<CreateDailySurveyResponse | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyTitle.trim()) {
      toast.error('설문 제목을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const res = await handleCreateSurvey(surveyTitle.trim(), clientRequestId);
      setCreatedResult(res);
      toast.success('일일 모임 설문이 성공적으로 생성 및 연결되었습니다!');
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '설문 생성 중 오류가 발생했습니다.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdResult?.formResponderUrl) return;
    try {
      await navigator.clipboard.writeText(createdResult.formResponderUrl);
      toast.success('설문 참여 링크가 클립보드에 복사되었습니다. 단톡방에 공지하세요!');
    } catch {
      toast.error('링크 복사에 실패했습니다.');
    }
  };

  const handleClose = () => {
    setCreatedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">일일 모임 설문 생성</h3>
              <p className="text-xs text-slate-500">Google Form 복제 및 응답 Sheet 자동 연동</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {!createdResult ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="surveyTitle" className="block text-xs font-semibold text-slate-700">
                설문 제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="surveyTitle"
                type="text"
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                placeholder="예: 2026-08-22 정기모임 참석 조사"
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-400">
                설정된 Form 템플릿을 복제하여 위 제목으로 Form 및 응답 Sheet를 생성합니다.
              </p>
            </div>

            {loading && (
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-xs text-purple-700 flex items-center gap-2 animate-pulse">
                <Loader2 size={16} className="animate-spin text-purple-600 shrink-0" />
                <span>Form 복제 및 응답 Sheet 연결 중입니다... (약 2~4초 소요)</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !surveyTitle.trim()}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{loading ? '생성 중...' : '설문 생성 및 연결'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-900">설문 생성 및 출석부 연동 완료!</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  새로 생성된 설문 Sheet가 <strong>오늘 모임 출석부 소스로 자동 연결</strong>되었습니다.
                  회원들이 응답을 제출하면 [Google Sheet 동기화] 버튼을 눌러 명단을 불러올 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">설문 참여 링크</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate">
                  {createdResult.formResponderUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Copy size={14} />
                  <span>링크 복사</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://docs.google.com/forms/d/${createdResult.formId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText size={14} />
                <span>Form 열기</span>
                <ExternalLink size={12} />
              </a>
              <a
                href={`https://docs.google.com/spreadsheets/d/${createdResult.spreadsheetId}/edit#gid=${createdResult.sheetId}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet size={14} />
                <span>응답 Sheet 열기</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
