import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { MemberMemoConflictError, updateMemberMemo } from '../services/memberMemoService';

/** The profile mounts this editor with a key per member, isolating draft lifetimes. */
export function useMemberMemo(memberId: string, memo: string) {
  const [edit, setEdit] = useState<{ base: string; draft: string } | null>(null);
  const [saved, setSaved] = useState<{ previous: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflictMemo, setConflictMemo] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Retire an optimistic value once the subscription acknowledges or supersedes
  // it, so a later intentional revert to the old text remains visible.
  if (saved && memo !== saved.previous) setSaved(null);
  // Show our successful write while waiting for the shared members subscription.
  const displayMemo = saved && memo === saved.previous ? saved.value : memo;
  const beginEdit = () => {
    if (busy.current) return;
    setEdit({ base: displayMemo, draft: displayMemo }); setError(''); setConflictMemo(null);
  };
  const cancel = () => {
    if (busy.current) return;
    setEdit(null); setError(''); setConflictMemo(null);
  };
  const loadLatest = () => {
    if (busy.current || conflictMemo === null) return;
    setSaved({ previous: memo, value: conflictMemo });
    setEdit({ base: conflictMemo, draft: conflictMemo }); setError(''); setConflictMemo(null);
  };
  const save = async () => {
    if (!edit || busy.current || edit.draft === edit.base || conflictMemo !== null) return;
    busy.current = true; setSaving(true); setError('');
    const submitted = edit.draft;
    try {
      await updateMemberMemo(memberId, edit.base, submitted);
      if (!mounted.current) return;
      setSaved({ previous: memo, value: submitted }); setEdit(null); setConflictMemo(null);
      toast.success('메모가 저장되었습니다.');
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof MemberMemoConflictError) {
        setConflictMemo(failure.currentMemo); setError(failure.message);
      } else {
        setError('메모를 저장하지 못했습니다. 입력 내용을 유지했으니 다시 시도해주세요.');
        handleFirestoreError(failure, OperationType.UPDATE, `members/${memberId}`);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return {
    displayMemo, editing: edit !== null, draft: edit?.draft ?? '', saving, error, conflictMemo,
    canSave: !!edit && !saving && edit.draft !== edit.base && conflictMemo === null,
    beginEdit, cancel, loadLatest, save,
    setDraft: (draft: string) => { if (!busy.current) setEdit(current => current ? { ...current, draft } : null); },
  };
}
