import { describe, it, expect } from 'vitest';
import { getGoogleWorkspacePermissions } from './GoogleWorkspaceSettings';

describe('GoogleWorkspaceSettings Permissions & RBAC', () => {
  it('일반 Admin에게는 상태 조회 및 수동 Sheet 선택 권한만 허용하고 템플릿/계정 관리는 비활성화한다', () => {
    const permissions = getGoogleWorkspacePermissions('admin');

    expect(permissions.canViewPublicStatus).toBe(true);
    expect(permissions.canSelectSheetSource).toBe(true);
    expect(permissions.canChangeFormTemplate).toBe(false);
    expect(permissions.canManageGoogleAccount).toBe(false);
  });

  it('Master Admin에게는 템플릿 변경 및 계정 연결/해제를 포함한 전체 권한을 허용한다', () => {
    const permissions = getGoogleWorkspacePermissions('master');

    expect(permissions.canViewPublicStatus).toBe(true);
    expect(permissions.canSelectSheetSource).toBe(true);
    expect(permissions.canChangeFormTemplate).toBe(true);
    expect(permissions.canManageGoogleAccount).toBe(true);
  });

  it('기본값(default)은 일반 Admin 권한으로 안전하게 제한된다', () => {
    const permissions = getGoogleWorkspacePermissions();

    expect(permissions.canViewPublicStatus).toBe(true);
    expect(permissions.canSelectSheetSource).toBe(true);
    expect(permissions.canChangeFormTemplate).toBe(false);
    expect(permissions.canManageGoogleAccount).toBe(false);
  });
});
