import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import MemberProfileModal from '../components/MemberProfileModal';
import { MemberMemoConflictError, updateMemberMemo } from '../services/memberMemoService';
import type { Member } from '../types';

vi.mock('../lib/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: { UPDATE: 'update' } }));
vi.mock('../services/memberMemoService', async importOriginal => ({
  ...await importOriginal<typeof import('../services/memberMemoService')>(), updateMemberMemo: vi.fn(),
}));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(), getDocs: vi.fn(async () => ({ docs: [] })),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const original: Member = { id: 'one', name: '합성회원', nickname: '', studentId: '260001', phone: '', gender: '남',
  semester: '2026-2', preferredGenre: [], createdAt: Timestamp.fromMillis(0), memo: '기존 메모' };

describe('profile memo editing', () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const render = (member: Member | null = original, members = member ? [member] : []) =>
    act(async () => root.render(<MemberProfileModal member={member} members={members} games={[]} onClose={vi.fn()} />));
  const typeMemo = (text: string) => act(() => {
    const textarea = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const click = (label: string) => act(async () => button(label).click());
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(updateMemberMemo).mockResolvedValue();
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container); await render();
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('edits without an admin edit mode prop and cancels without writing', async () => {
    expect(button('메모 수정')).not.toBeNull();
    await click('메모 수정'); typeMemo('미저장');
    await click('메모 수정 취소');
    expect(container.textContent).toContain('기존 메모');
    expect(updateMemberMemo).not.toHaveBeenCalled();
  });

  it('saves the selected member memo once, locks pending actions and follows shared updates', async () => {
    let finish!: () => void;
    vi.mocked(updateMemberMemo).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await click('메모 수정'); typeMemo('새 메모\n다음 줄');
    await click('메모 저장');
    expect(button('메모 저장').disabled).toBe(true);
    expect(button('메모 수정 취소').disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[title="닫기"]')!.disabled).toBe(true);
    await click('메모 저장');
    expect(updateMemberMemo).toHaveBeenCalledExactlyOnceWith('one', '기존 메모', '새 메모\n다음 줄');
    await act(async () => finish());
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('새 메모');
    await render(original, [{ ...original, memo: '새 메모\n다음 줄' }]);
    await render(original, [{ ...original, memo: '기존 메모' }]);
    expect(container.textContent).toContain('기존 메모');
    expect(container.textContent).not.toContain('다음 줄');
  });

  it('retains failed input for retry and permits clearing the memo', async () => {
    vi.mocked(updateMemberMemo).mockRejectedValueOnce(new Error('offline'));
    await click('메모 수정'); typeMemo(''); await click('메모 저장');
    expect(container.querySelector('textarea')!.value).toBe('');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('입력 내용을 유지');
    await click('메모 저장');
    expect(updateMemberMemo).toHaveBeenLastCalledWith('one', '기존 메모', '');
    expect(container.textContent).toContain('기록된 메모가 없습니다.');
  });

  it('keeps local edits when another editor saves and explicitly reloads the conflicting memo', async () => {
    vi.mocked(updateMemberMemo).mockRejectedValueOnce(new MemberMemoConflictError('다른 관리자의 메모'));
    await click('메모 수정'); typeMemo('내 입력');
    await render(original, [{ ...original, memo: '다른 관리자의 메모' }]);
    expect(container.querySelector('textarea')!.value).toBe('내 입력');
    await click('메모 저장');
    expect(container.querySelector('textarea')!.value).toBe('내 입력');
    expect(button('메모 저장').disabled).toBe(true);
    const load = [...container.querySelectorAll('button')].find(b => b.textContent === '입력 대신 최신 메모 불러오기')!;
    await act(async () => load.click());
    expect(container.querySelector('textarea')!.value).toBe('다른 관리자의 메모');
    typeMemo('확인 후 수정'); await click('메모 저장');
    expect(updateMemberMemo).toHaveBeenLastCalledWith('one', '다른 관리자의 메모', '확인 후 수정');
  });

  it('isolates drafts and late save completions when another profile opens', async () => {
    let finish!: () => void;
    vi.mocked(updateMemberMemo).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await click('메모 수정'); typeMemo('첫 회원 수정'); await click('메모 저장');
    const second = { ...original, id: 'two', name: '두 번째 회원', memo: '두 번째 메모' };
    await render(second);
    await act(async () => finish());
    expect(container.textContent).toContain('두 번째 메모');
    expect(container.textContent).not.toContain('첫 회원 수정');
    await click('메모 수정');
    expect(container.querySelector('textarea')!.value).toBe('두 번째 메모');
    await render(null);
    await render(second);
    expect(container.querySelector('textarea')).toBeNull();
  });
});
