import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../components/SettingsPage';
import { Timestamp } from 'firebase/firestore';
import { listAdmins, removeAdminRecord } from '../services/settingsService';

vi.mock('../services/settingsService', () => ({
  listAdmins: vi.fn(), removeAdminRecord: vi.fn(), addAdminRecord: vi.fn(),
  AdminAlreadyExistsError: class extends Error {},
}));
vi.mock('../lib/firebase', () => ({ handleFirestoreError: vi.fn(), OperationType: { DELETE: 'delete' } }));
vi.mock('../hooks/useClubExports', () => ({ useClubExports: () => ({}) }));
vi.mock('../components/SettingsExportPanel', () => ({ default: () => null }));
vi.mock('../components/SettingsAuditPanel', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('administrator deletion confirmation', () => {
  let container: HTMLDivElement;
  let root: Root;
  const email = 'admin@example.com';
  const button = (text: string) => [...container.querySelectorAll('button')].find(el => el.textContent === text)!;
  const requestDeletion = async () => {
    await act(async () => (container.querySelector(`[aria-label="${email} 관리자 권한 삭제"]`) as HTMLButtonElement).click());
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(listAdmins).mockResolvedValue([
      { id: 'master@example.com', email: 'master@example.com', createdAt: Timestamp.fromMillis(0), role: 'master' },
      { id: email, email, createdAt: Timestamp.fromMillis(0), role: 'admin' },
    ]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SettingsPage isMasterAdmin isAdminModeActive={false} setIsAdminModeActive={vi.fn()} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('does not delete on opening or cancelling; confirms the selected account once while busy', async () => {
    expect(container.querySelector('[aria-label="master@example.com 관리자 권한 삭제"]')).toBeNull();
    await requestDeletion();
    expect(container.textContent).toContain(`'${email}' 계정의 관리자 권한을 삭제하시겠습니까?`);
    expect(removeAdminRecord).not.toHaveBeenCalled();
    await act(async () => button('취소').click());
    expect(removeAdminRecord).not.toHaveBeenCalled();
    await requestDeletion();
    let finish!: () => void;
    vi.mocked(removeAdminRecord).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await act(async () => button('삭제').click());
    expect(button('취소').disabled).toBe(true);
    expect(removeAdminRecord).toHaveBeenCalledExactlyOnceWith(email);
    await act(async () => finish());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(container.querySelector('h3')).toBeNull();
  });

  it('keeps the confirmation available for retry when deletion fails', async () => {
    vi.mocked(removeAdminRecord).mockRejectedValueOnce(new Error('offline'));
    await requestDeletion();
    await act(async () => button('삭제').click());
    expect(container.querySelector('h3')?.textContent).toBe('관리자 권한 삭제');
    expect(button('삭제').disabled).toBe(false);
    vi.mocked(removeAdminRecord).mockResolvedValueOnce();
    await act(async () => button('삭제').click());
    expect(removeAdminRecord).toHaveBeenCalledTimes(2);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(container.querySelector('h3')).toBeNull();
  });
});
