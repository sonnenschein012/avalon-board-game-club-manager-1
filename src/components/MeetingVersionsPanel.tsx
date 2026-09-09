import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useMeetingVersions } from '../hooks/useMeetingRecords';
import type { Member } from '../types';

export default function MeetingVersionsPanel({ planningId, members, onBack, onRestored, onBusyChange }: {
  planningId: string; members: Member[]; onBack: () => void; onRestored: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const { versions, loading, error, restore: restoreVersion } = useMeetingVersions(planningId);
  const [selectedId, setSelectedId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const selected = versions.find(version => version.id === selectedId);

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

  return <div className="space-y-4">
    <button type="button" disabled={busy} onClick={onBack} className="text-sm font-bold text-navy">← 기록 목록</button>
    <h3 className="font-black text-navy">{planningId} 이전 버전</h3>
    <p className="text-xs leading-5 text-slate-500">덮어쓰기 전 내용을 보관합니다. 버전을 선택해 내용을 확인하고 복원할 수 있습니다. 세션 기록은 바뀌지 않습니다.</p>
    {loading && <p role="status">이전 버전을 불러오는 중입니다.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!loading && !error && versions.length === 0 && <p className="py-6 text-sm text-slate-500">보관된 이전 버전이 없습니다. 이 기능 적용 후 덮어쓴 내용부터 보관됩니다.</p>}
    {!error && versions.map(version => <button key={version.id} type="button" disabled={busy} aria-pressed={selectedId === version.id} onClick={() => { setSelectedId(version.id); setConfirming(false); }} className={`block w-full rounded-xl border p-3 text-left text-sm ${selectedId === version.id ? 'border-navy bg-slate-100' : 'border-slate-200'}`}>
      <strong className="block">{version.snapshot.name}</strong>
      <span className="mt-1 block text-xs text-slate-500">보관: {version.archivedAt?.toDate?.().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) ?? '저장 중'} · {version.reason}</span>
      <span className="mt-1 block break-all text-xs text-slate-500">{version.actorEmail}</span>
    </button>)}
    {!error && selected && <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <h4 className="font-bold text-navy">복원할 내용: {selected.snapshot.name}</h4>
      {!selected.snapshot.attendees && <p className="text-xs text-amber-700">이 버전에는 저장된 음료·희망사항이 없습니다. 복원하면 해당 정보도 없는 상태로 돌아갑니다.</p>}
      {selected.snapshot.groups.map((group, index) => <div key={group.id} className="space-y-2">
        <h5 className="text-sm font-bold text-navy">{group.name || `TEAM ${index + 1}`}</h5>
        {group.memberIds.map(id => {
          const attendee = selected.snapshot.attendees?.find(item => item.memberId === id);
          const name = attendee?.name ?? members.find(member => member.id === id)?.name ?? '삭제된 동아리원';
          return <div key={id} className="rounded-lg bg-slate-50 p-2 text-xs leading-5"><strong>{name}</strong><p>음료: {attendee?.drink || '없음'}</p><p className="whitespace-pre-wrap break-words">희망사항: {attendee?.request || '없음'}</p></div>;
        })}
      </div>)}
      {confirming ? <div className="space-y-3 rounded-xl bg-amber-50 p-3">
        <p className="text-sm text-amber-900">선택한 버전으로 복원할까요? 현재 내용도 이전 버전으로 보관합니다. 세션 기록은 유지되고 변경 이력에 남습니다.</p>
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2 text-sm font-bold">취소</button><button type="button" disabled={busy} onClick={() => void restore()} className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white">{busy ? '복원 중…' : '복원 확인'}</button></div>
      </div> : <button type="button" onClick={() => setConfirming(true)} className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white">이 버전으로 복원</button>}
    </div>}
  </div>;
}
