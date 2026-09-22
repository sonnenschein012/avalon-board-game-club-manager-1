import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useMeetingRecords, type MeetingRecord } from '../hooks/useMeetingRecords';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import MeetingVersionsPanel from './MeetingVersionsPanel';
import type { Member } from '../types';

export default function MeetingRecordsModal({ onClose, onView, members }: { onClose: () => void; onView: (date: string) => void; members: Member[] }) {
  const { records, loading, error, remove: removeRecord } = useMeetingRecords();
  const [deleting, setDeleting] = useState<MeetingRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [versionRecord, setVersionRecord] = useState<MeetingRecord | null>(null);
  const saving = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const remove = async () => {
    if (!deleting || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await removeRecord(deleting.id);
      setDeleting(null);
      toast.success('모임 진행 정보를 삭제했습니다. 세션 기록은 유지됩니다.');
    } catch {
      toast.error('삭제하지 못했습니다. 다시 시도해주세요.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onKeyDown={event => {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      if (deleting) setDeleting(null);
      else onClose();
    }
  }}>
    <section role="dialog" aria-modal="true" aria-label="모임 진행 기록 관리" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-3xl bg-white p-5 shadow-xl sm:max-h-[85dvh]">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div><h2 className="text-lg font-bold text-navy">모임 진행 기록 관리</h2>{!versionRecord && <p className="mt-2 text-sm text-slate-500">날짜별 조 구성·음료·희망사항을 열람하거나 삭제합니다. 세션 기록은 유지됩니다.</p>}</div>
        <button ref={closeButton} type="button" aria-label="닫기" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <div className={`mt-5 min-h-0 ${versionRecord ? 'flex flex-col overflow-hidden' : 'space-y-3 overflow-y-auto'}`}>
        {versionRecord ? <MeetingVersionsPanel key={versionRecord.id} planningId={versionRecord.id} members={members} onBack={() => setVersionRecord(null)} onRestored={() => onView(versionRecord.id)} onBusyChange={setBusy} /> : <>
        {loading && <p role="status" className="py-8 text-center text-sm text-slate-500">기록을 불러오는 중입니다.</p>}
        {error && <p role="alert" className="py-6 text-sm text-red-600">{error}</p>}
        {!loading && !error && records.length === 0 && <p className="py-8 text-center text-sm text-slate-500">저장된 모임 진행 기록이 없습니다.</p>}
        {!error && records.slice(0, visibleCount).map(record => <article key={record.id} className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500">{record.date}</p>
          <h3 className="mt-1 break-words font-bold text-navy">{record.name || '이름 없는 모임'}</h3>
          <p className="mt-1 text-xs text-slate-500">{record.groups.length}개 조 · {new Set(record.groups.flatMap(group => group.memberIds)).size}명</p>
          {!record.attendees && <p className="mt-2 text-xs text-amber-700">음료·희망사항이 별도로 저장되지 않은 이전 기록입니다.</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => onView(record.id)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-navy" aria-label={`${record.date} ${record.name} 열람`}>열람</button>
            <button type="button" disabled={busy} onClick={() => setVersionRecord(record)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-navy" aria-label={`${record.date} ${record.name} 이전 버전`}>이전 버전</button>
            <button type="button" disabled={busy} onClick={() => setDeleting(record)} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600" aria-label={`${record.date} ${record.name} 삭제`}>삭제</button>
          </div>
        </article>)}
        {!error && visibleCount < records.length && <button type="button" onClick={() => setVisibleCount(count => count + 20)} className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-navy">더 보기 ({Math.min(visibleCount, records.length)}/{records.length})</button>}
        </>}
      </div>
    </section>
    <ConfirmDeleteModal isOpen={deleting !== null} title="모임 진행 정보 삭제" message={deleting ? `${deleting.date} · ${deleting.name}의 조 구성·음료·희망사항과 모든 이전 버전을 삭제합니다. 복구할 수 없습니다. 세션 기록은 유지되며 변경 이력에 삭제 내역이 남습니다.` : ''} busy={busy} onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => void remove()} />
  </div>;
}
