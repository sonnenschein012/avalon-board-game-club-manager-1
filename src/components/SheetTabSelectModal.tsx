import React, { useState } from 'react';
import { SheetTabInfo } from '../types/googleWorkspace';
import { FileSpreadsheet, X, Check } from 'lucide-react';

interface SheetTabSelectModalProps {
  isOpen: boolean;
  spreadsheetTitle: string;
  tabs: SheetTabInfo[];
  defaultTabId?: number;
  onSelect: (selectedTab: SheetTabInfo) => void;
  onClose: () => void;
}

export default function SheetTabSelectModal({
  isOpen,
  spreadsheetTitle,
  tabs,
  defaultTabId,
  onSelect,
  onClose,
}: SheetTabSelectModalProps) {
  const [selectedTabId, setSelectedTabId] = useState<number>(
    defaultTabId ?? (tabs[0]?.sheetId ?? 0)
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    const chosen = tabs.find((t) => t.sheetId === selectedTabId) || tabs[0];
    if (chosen) {
      onSelect(chosen);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            <h3 className="font-bold text-navy text-base">스프레드시트 탭 선택</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">[{spreadsheetTitle}]</span> 문서에 여러 개의 시트(탭)가 있습니다. 참석자 응답이 들어있는 탭을 선택해주세요.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tabs.map((tab) => {
              const isSelected = tab.sheetId === selectedTabId;
              return (
                <button
                  key={tab.sheetId}
                  type="button"
                  onClick={() => setSelectedTabId(tab.sheetId)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>{tab.title}</span>
                  </div>
                  {isSelected && <Check size={16} className="text-emerald-600 font-bold" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-bold text-white bg-navy hover:bg-navy/90 rounded-xl transition-colors shadow-sm"
          >
            이 탭으로 선택
          </button>
        </div>
      </div>
    </div>
  );
}
