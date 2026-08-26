import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { InterviewRound } from '../types';

interface Props {
  open: boolean;
  round: InterviewRound | null;
  applicantCount: number;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function InterviewRoundDeleteModal({ open, round, applicantCount, deleting, onClose, onConfirm }: Props) {
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);
  const matches = Boolean(round && confirmation.trim() === round.name);

  return <AnimatePresence>{open && round && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/25 p-4 backdrop-blur-sm">
    <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} role="dialog" aria-modal="true" aria-labelledby="round-delete-title" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={19} /></span><div><h2 id="round-delete-title" className="font-black text-navy">면접 회차 영구 삭제</h2><p className="mt-1 text-xs text-slate-500">삭제 후에는 복구할 수 없습니다.</p></div></div>
        <button type="button" disabled={deleting} onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy disabled:opacity-40"><X size={17} /></button>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800"><strong className="block font-black">{round.name}</strong><p className="mt-1 text-xs leading-5 text-red-700">지원자 {applicantCount}명, 개인 링크, 일정, 면접관 배정, 평가와 이력을 모두 삭제합니다. 이미 등록된 동아리원 정보는 유지됩니다.</p></div>
        <label className="block text-xs font-bold text-slate-600">확인을 위해 회차명을 그대로 입력해주세요.<input autoFocus value={confirmation} disabled={deleting} onChange={event => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-navy outline-none focus:border-red-300 disabled:bg-slate-50" placeholder={round.name} /></label>
        <div className="flex gap-2"><button type="button" disabled={deleting} onClick={onClose} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-200 disabled:opacity-40">취소</button><button type="button" disabled={!matches || deleting} onClick={onConfirm} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-35">{deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}{deleting ? '삭제 중' : '회차 삭제'}</button></div>
      </div>
    </motion.section>
  </div>}</AnimatePresence>;
}
