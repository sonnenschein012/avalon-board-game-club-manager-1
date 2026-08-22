import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  requestGoogleAuthUrl,
  exchangeGoogleAuthCode,
  reconnectGoogle,
  changeGoogleAccount,
  disconnectGoogleConnection,
  getPickerAccessToken,
  validateAndSetFormTemplate,
  inspectAndValidateSheet,
  setGoogleWorkspaceApiClient,
  GOOGLE_WORKSPACE_USER_MESSAGES,
  mapGoogleWorkspaceErrorMessage,
} from './googleWorkspaceService';

describe('googleWorkspaceService', () => {
  const mockApiClient = {
    callFunction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setGoogleWorkspaceApiClient(mockApiClient);
  });

  describe('mapGoogleWorkspaceErrorMessage', () => {
    it('maps CSRF state error correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('invalid_state csrf error'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.CSRF_INVALID_STATE
      );
    });

    it('maps account change validation failure correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('account_change_failed'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.ACCOUNT_CHANGE_FAILED
      );
    });

    it('maps authentication failure correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('unauthenticated'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.NOT_CONNECTED
      );
    });

    it('maps token expiration correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('token_expired invalid_grant'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.REAUTH_REQUIRED
      );
    });

    it('maps permission denied correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('permission_denied: not master admin'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.PERMISSION_DENIED
      );
    });

    it('maps template not found correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('template_not_found'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.TEMPLATE_NOT_FOUND
      );
    });

    it('maps template access denied correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('template_access_denied: 403'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.TEMPLATE_ACCESS_DENIED
      );
    });

    it('maps form mime error correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('선택한 파일이 Google 설문지(Google Forms) 형식이 아닙니다.'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.INVALID_FORM_MIME
      );
    });

    it('maps sheet mime error correctly', () => {
      expect(mapGoogleWorkspaceErrorMessage(new Error('선택한 파일이 Google 스프레드시트(Google Sheets) 형식이 아닙니다.'))).toBe(
        GOOGLE_WORKSPACE_USER_MESSAGES.INVALID_SHEET_MIME
      );
    });
  });

  describe('API calling wrappers', () => {
    it('requests auth url with CSRF state token and mode', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123',
        state: 'csrf_state_xyz',
      });

      const res = await requestGoogleAuthUrl('connect', 'https://localhost/callback');
      expect(res.authUrl).toContain('https://accounts.google.com');
      expect(res.state).toBe('csrf_state_xyz');
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('getGoogleAuthUrl', {
        mode: 'connect',
        redirectUri: 'https://localhost/callback',
      });
    });

    it('exchanges auth code with CSRF state and returns connected info', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        success: true,
        connectedEmail: 'avalon.club@gmail.com',
        mode: 'connect',
      });

      const res = await exchangeGoogleAuthCode({
        code: 'test_code_123',
        state: 'csrf_state_xyz',
        redirectUri: 'https://localhost/callback',
      });
      expect(res.success).toBe(true);
      expect(res.connectedEmail).toBe('avalon.club@gmail.com');
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('exchangeGoogleAuthCode', {
        code: 'test_code_123',
        state: 'csrf_state_xyz',
        redirectUri: 'https://localhost/callback',
      });
    });

    it('handles reconnectGoogle wrapper', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        success: true,
        connectedEmail: 'avalon.club@gmail.com',
        mode: 'reconnect',
      });

      const res = await reconnectGoogle({
        code: 'reconnect_code',
        state: 'csrf_state_xyz',
      });
      expect(res.mode).toBe('reconnect');
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('exchangeGoogleAuthCode', {
        code: 'reconnect_code',
        state: 'csrf_state_xyz',
        mode: 'reconnect',
      });
    });

    it('handles changeGoogleAccount wrapper', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        success: true,
        connectedEmail: 'new.club@gmail.com',
        mode: 'change',
      });

      const res = await changeGoogleAccount({
        code: 'change_code',
        state: 'csrf_state_xyz',
      });
      expect(res.mode).toBe('change');
      expect(res.connectedEmail).toBe('new.club@gmail.com');
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('exchangeGoogleAuthCode', {
        code: 'change_code',
        state: 'csrf_state_xyz',
        mode: 'change',
      });
    });

    it('disconnects google connection and reports revocation details', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        success: true,
        revocationAttempted: true,
        revocationSucceeded: true,
      });

      const res = await disconnectGoogleConnection();
      expect(res.success).toBe(true);
      expect(res.revocationSucceeded).toBe(true);
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('disconnectGoogleConnection');
    });

    it('gets picker short-lived access token in memory', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        accessToken: 'ya29.short_lived_token_for_picker',
        expiresIn: 3599,
      });

      const res = await getPickerAccessToken();
      expect(res.accessToken).toBe('ya29.short_lived_token_for_picker');
      expect(res.expiresIn).toBe(3599);
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('getGooglePickerToken');
    });

    it('validates and sets Form template', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        success: true,
        formId: 'form_123',
        title: '정기모임 설문 템플릿',
      });

      const res = await validateAndSetFormTemplate('form_123');
      expect(res.success).toBe(true);
      expect(res.title).toBe('정기모임 설문 템플릿');
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('validateAndSetFormTemplate', {
        formId: 'form_123',
      });
    });

    it('inspects and validates Google Sheet metadata and tabs', async () => {
      mockApiClient.callFunction.mockResolvedValueOnce({
        id: 'sheet_456',
        title: '출석 응답 시트',
        tabs: [
          { sheetId: 0, title: '응답1', index: 0 },
          { sheetId: 99, title: '응답2', index: 1 },
        ],
        defaultTabId: 0,
      });

      const res = await inspectAndValidateSheet('sheet_456');
      expect(res.title).toBe('출석 응답 시트');
      expect(res.tabs).toHaveLength(2);
      expect(res.tabs[1]?.sheetId).toBe(99);
      expect(mockApiClient.callFunction).toHaveBeenCalledWith('inspectAndValidateSheet', {
        spreadsheetId: 'sheet_456',
      });
    });
  });
});
