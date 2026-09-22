import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useMeetingVersions } from '../hooks/useMeetingRecords';
import type { Member } from '../types';
import type { DailyPlanningVersion } from '../services/dailyPlanningService';

const archivedLabel = (version: DailyPlanningVersion) => version.archivedAt?.toDate?.().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) ?? '저장 중';
const control = 'min-h-11 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50';

export default function MeetingVersionsPanel({ planningId, members, onBack, onRestored, onBusyChange }: {
  planningId: string; members: Member[]; onBack: () => void; onRestored: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const { versions, loading, error, restore: restoreVersion } = useMeetingVersions(planningId);
  const [selectedId, setSelectedId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const listPosition = useRef(0);
  const lastSelectedId = useRef('');
  const versionButtons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const selected = versions.find(version => version.id === selectedId);

  useLayoutEffect(() => {
    if (selectedId) heading.current?.focus();
    else if (lastSelectedId.current) {
      versionButtons.current.get(lastSelectedId.current)?.focus({ preventScroll: true });
      if (list.current) list.current.scrollTop = listPosition.current;
    }
  }, [selectedId]);

  useLayoutEffect(() => {
    if (confirming) cancelButton.current?.focus();
  }, [confirming]);

  const cancelConfirmation = () => {
    setConfirming(false);
    requestAnimationFrame(() => restoreButton.current?.focus());
  };
  const backToVersions = () => { setConfirming(false); setSelectedId(''); };
  const restore = async () => {
    if (!selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      await restoreVersion(selected.id);
      toast.success('이전 버전으로 복원했습니다. 복원 전 내용도 보관했습니다.');
      onRestored();
    } catch {
      toast.error('복원하지 못했습니다. 다시 시도해주세요.');
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };

  return <div className="flex min-h-0 flex-col" onKeyDown={event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (busy) return;
    if (confirming) cancelConfirmation();
    else if (selectedId) backToVersions();
    else onBack();
  }}>
    <div className="shrink-0 space-y-2 pb-3">
      <button type="button" disabled={busy} onClick={selectedId ? backToVersions : onBack} className={`${control} -ml-4 text-navy`}>
        {selectedId ? '← 버전 목록' : '← 기록 목록'}
      </button>
      <h3 ref={heading} tabIndex={-1} className="break-words text-lg font-semibold text-navy focus:outline-none">
        {selected ? selected.snapshot.name || '이름 없는 모임' : `${planningId} 이전 버전`}
      </h3>
      {selected ? <div className="space-y-1 text-xs leading-5 text-slate-500">
        <p>보관: {archivedLabel(selected)}</p>
        <p className="font-semibold text-navy">{selected.snapshot.groups.length}개 조 · {new Set(selected.snapshot.groups.flatMap(group => group.memberIds)).size}명</p>
      </div> : <p className="text-sm leading-5 text-slate-500">버전을 선택하면 조 구성·음료·희망사항을 확인하고 복원할 수 있습니다.</p>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!selected && <div ref={list} aria-label="이전 버전 목록" className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-1">
      {loading && <p role="status">이전 버전을 불러오는 중입니다.</p>}
      {!loading && !error && versions.length === 0 && <p className="py-6 text-sm text-slate-500">보관된 이전 버전이 없습니다. 이 기능 적용 후 덮어쓴 내용부터 보관됩니다.</p>}
      {!error && versions.map(version => <button key={version.id} ref={element => { if (element) versionButtons.current.set(version.id, element); else versionButtons.current.delete(version.id); }} type="button" onClick={() => {
        listPosition.current = list.current?.scrollTop ?? 0;
        lastSelectedId.current = version.id;
        setSelectedId(version.id);
        setConfirming(false);
      }} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-semibold text-navy">{archivedLabel(version)}</span>
          <span className="block break-words text-sm text-navy">{version.snapshot.name || '이름 없는 모임'}</span>
          <span className="block break-words text-xs leading-5 text-slate-500">{version.reason}</span>
          <span className="block break-all text-xs leading-5 text-slate-500">{version.actorEmail}</span>
        </span>
        <span className="flex shrink-0 items-center text-xs font-semibold text-navy">상세 보기<ChevronRight size={16} aria-hidden="true" /></span>
      </button>)}
    </div>}
    {!error && selected && <>
      <div aria-label="선택한 버전 상세" className="min-h-0 space-y-4 overflow-y-auto overscroll-contain border-t border-slate-200 py-4 pr-1">
        <div className="space-y-1 text-xs leading-5 text-slate-500"><p className="break-words">{selected.reason}</p><p className="break-all">{selected.actorEmail}</p></div>
        {!selected.snapshot.attendees && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900">이 버전에는 저장된 음료·희망사항이 없습니다. 복원하면 해당 정보도 없는 상태로 돌아갑니다.</p>}
        {selected.snapshot.groups.length === 0 && <p className="text-sm text-slate-500">저장된 조 구성이 없습니다.</p>}
        {selected.snapshot.groups.map((group, index) => <section key={group.id} className="space-y-2">
          <h4 className="break-words text-sm font-semibold text-navy">{group.name || `TEAM ${index + 1}`}</h4>
          {group.memberIds.map(id => {
            const attendee = selected.snapshot.attendees?.find(item => item.memberId === id);
            const name = attendee?.name ?? members.find(member => member.id === id)?.name ?? '삭제된 동아리원';
            return <div key={id} className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm leading-5"><p className="break-words font-semibold text-navy">{name}</p><p className="break-words">음료: {attendee?.drink || '없음'}</p><p className="whitespace-pre-wrap break-words">희망사항: {attendee?.request || '없음'}</p></div>;
          })}
        </section>)}
      </div>
      <div className="shrink-0 space-y-3 border-t border-slate-200 pt-3" aria-label="버전 복원">
        <p className="text-xs leading-5 text-slate-500">현재 내용도 이전 버전으로 보관합니다. 세션 기록은 유지됩니다.</p>
        {confirming ? <>
          <p role="status" className="text-sm font-semibold text-navy">이 버전으로 복원할까요?</p>
          <div className="flex justify-end gap-2"><button ref={cancelButton} type="button" disabled={busy} onClick={cancelConfirmation} className={`${control} border border-slate-200 text-navy`}>취소</button><button type="button" disabled={busy} onClick={() => void restore()} className={`${control} bg-navy text-white`}>{busy ? '복원 중…' : '복원 확인'}</button></div>
        </> : <button ref={restoreButton} type="button" onClick={() => setConfirming(true)} className={`${control} w-full bg-navy text-white sm:w-auto sm:float-right`}>이 버전으로 복원</button>}
      </div>
    </>}
  </div>;
}
