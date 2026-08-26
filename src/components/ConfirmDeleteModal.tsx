import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  busyLabel?: string;
}

export default function ConfirmDeleteModal({ isOpen, title, message, onConfirm, onCancel, busy = false, busyLabel = '삭제 중…' }: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/20 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-black text-navy">{title}</h3>
              </div>
              {message && <p className="text-sm text-slate-500 font-medium mb-6">{message}</p>}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  disabled={busy}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={onConfirm}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-crimson text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-200 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}{busy ? busyLabel : '삭제'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
