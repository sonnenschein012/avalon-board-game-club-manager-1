import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { RequestChoice } from '../domain/matching/companionRequests';

const studentYear = (studentId: string) => studentId.match(/^20(\d{2})|^(\d{2})/)?.slice(1).find(Boolean);

export default function CompanionRequestModal({ choice, onConfirm, onClose }: {
  choice: RequestChoice;
  onConfirm: (recipientId: string | null) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState(choice.selectedId ?? '');
  const longRequest = choice.request.length > 80 || choice.request.split('\n').length > 3;
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="companion-request-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white p-0 text-navy shadow-xl backdrop:bg-navy/40 backdrop:backdrop-blur-sm">
    <form onSubmit={event => { event.preventDefault(); onConfirm(selectedId || null); }} className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 sm:px-8 sm:pt-7">
        <h2 id="companion-request-title" className="text-lg font-bold">동반 상대 선택</h2>
        <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"><X size={20} /></button>
      </header>
      <div className="min-h-0 space-y-8 overflow-y-auto overscroll-contain px-6 pb-7 pt-6 sm:px-8 sm:pb-8">
        <div>
          <p className="mb-3 text-xs font-medium text-slate-500">{choice.requester}님의 요청 원문</p>
          {longRequest ? <details className="group rounded-2xl bg-slate-50 px-5 py-4">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 line-clamp-3 group-open:line-clamp-none">{choice.request}</span>
              <span className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500"><span className="group-open:hidden">원문 전체 보기</span><span className="hidden group-open:inline">원문 접기</span><ChevronDown size={14} className="group-open:rotate-180" /></span>
            </summary>
          </details> : <p className="whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">{choice.request}</p>}
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-4 text-sm font-semibold">‘{choice.mention}’의 상대</legend>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
          <label className={`flex min-h-14 cursor-pointer items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50 ${!selectedId ? 'bg-slate-50' : ''}`}>
            <input type="radio" name="companion-recipient" value="" checked={!selectedId} onChange={() => setSelectedId('')} className="size-4 shrink-0 accent-navy" />
            <span className="text-slate-600">상대 미확정</span>
          </label>
          {choice.candidates.map(candidate => {
            const year = studentYear(candidate.studentId);
            const namesakes = choice.candidates.filter(peer => peer.name === candidate.name && studentYear(peer.studentId) === year).length > 1;
            return <label key={candidate.id} className={`flex min-h-14 items-center gap-4 border-t border-slate-100 px-5 py-4 text-sm transition-colors ${candidate.memberId ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60'} ${selectedId === candidate.id ? 'bg-slate-50' : ''}`}>
            <input type="radio" name="companion-recipient" value={candidate.id} checked={selectedId === candidate.id} disabled={!candidate.memberId}
              onChange={() => setSelectedId(candidate.id)} className="size-4 shrink-0 accent-navy" />
            <span className="min-w-0 break-words"><span className="font-semibold">{candidate.name}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{year ? `${year}학번` : '학번 미입력'}{namesakes && candidate.studentId ? ` · ${candidate.studentId}` : ''}{candidate.nickname ? ` · ${candidate.nickname}` : ''}{!candidate.memberId ? ' · 부원 등록 필요' : ''}</span>
            </span>
          </label>; })}
          </div>
        </fieldset>
        <p className="text-xs leading-relaxed text-slate-500">미확정 요청은 평가에서 보류하며, 선택해도 현재 조 배치는 바뀌지 않습니다.</p>
      </div>
      <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-5 sm:px-8 sm:py-6">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">취소</button>
        <button type="submit" className="min-h-11 rounded-xl bg-navy px-6 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">선택 반영</button>
      </footer>
    </form>
  </dialog>;
}
