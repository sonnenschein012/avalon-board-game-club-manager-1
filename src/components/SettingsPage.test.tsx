import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './SettingsPage';

vi.mock('../hooks/useSettingsAdmins', () => ({ useSettingsAdmins: () => ({}) }));
vi.mock('../hooks/useClubExports', () => ({ useClubExports: () => ({}) }));
vi.mock('./SettingsAdminPanel', () => ({ default: () => <div>관리자 목록</div> }));
vi.mock('./SettingsExportPanel', () => ({ default: () => <div>내보내기</div> }));
vi.mock('./SettingsAuditPanel', () => ({ default: () => <div data-testid="audit-panel">변경 이력 패널</div> }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SettingsPage audit visibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows change history only to a master while admin edit mode is active', () => {
    const renderPage = (isMasterAdmin: boolean, isAdminModeActive: boolean) => act(() => root.render(
      <SettingsPage
        isMasterAdmin={isMasterAdmin}
        isAdminModeActive={isAdminModeActive}
        setIsAdminModeActive={vi.fn()}
      />,
    ));

    renderPage(true, false);
    expect(container.querySelector('[data-testid="audit-panel"]')).toBeNull();

    renderPage(false, true);
    expect(container.querySelector('[data-testid="audit-panel"]')).toBeNull();

    renderPage(true, true);
    expect(container.querySelector('[data-testid="audit-panel"]')?.textContent).toBe('변경 이력 패널');
  });
});
