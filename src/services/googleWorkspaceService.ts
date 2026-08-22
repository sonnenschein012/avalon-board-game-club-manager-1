import {
  GoogleConnectionPublicInfo,
  GoogleAuthUrlResponse,
  GoogleAuthExchangeRequest,
  GoogleAuthExchangeResponse,
  GoogleDisconnectResponse,
  GooglePickerTokenResponse,
  SpreadsheetMetadata,
  ValidateTemplateResponse,
  CurrentSheetSourceInfo,
} from '../types/googleWorkspace';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const GOOGLE_WORKSPACE_USER_MESSAGES = {
  NOT_CONNECTED: 'Google 계정을 연결해주세요.',
  REAUTH_REQUIRED: 'Google 연결을 다시 확인해야 합니다.',
  TEMPLATE_ACCESS_DENIED: '현재 계정으로 설문 템플릿에 접근할 수 없습니다.',
  TEMPLATE_NOT_FOUND: '설정된 설문 템플릿을 찾을 수 없습니다.',
  FORM_CLONE_FAILED: '설문을 생성하지 못했습니다.',
  SHEET_LINK_FAILED: '설문은 생성했지만 응답 Sheet 연결을 완료하지 못했습니다.',
  SHEET_ACCESS_DENIED: '현재 계정으로 이 응답 Sheet에 접근할 수 없습니다.',
  DATA_FORMAT_ERROR: '참석자 정보를 읽을 수 없는 응답이 있습니다.',
  GOOGLE_TEMPORARY_ERROR: 'Google 서비스에 일시적으로 연결할 수 없습니다.',
  AVALON_SAVE_FAILED: '응답은 읽었지만 Avalon 명단을 갱신하지 못했습니다.',
  PERMISSION_DENIED: '이 작업을 수행할 권한이 없습니다. (Master Admin 전용)',
  CSRF_INVALID_STATE: '인증 상태가 올바르지 않거나 만료되었습니다. 다시 시도해주세요.',
  ACCOUNT_CHANGE_FAILED: '새 계정 확인에 실패하여 기존 연결을 유지합니다.',
  INVALID_FORM_MIME: '선택한 파일이 Google 설문지(Google Forms) 형식이 아닙니다.',
  INVALID_SHEET_MIME: '선택한 파일이 Google 스프레드시트(Google Sheets) 형식이 아닙니다.',
} as const;

export class GoogleWorkspaceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GoogleWorkspaceError';
  }
}

/**
 * Maps arbitrary raw error or code into user-friendly message as per Section 39.
 */
export function mapGoogleWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof GoogleWorkspaceError) {
    return error.message;
  }
  const errString = error instanceof Error ? error.message : String(error);

  if (errString.includes('Google 설문지') || errString.includes('INVALID_FORM_MIME')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.INVALID_FORM_MIME;
  }
  if (errString.includes('Google 스프레드시트') || errString.includes('INVALID_SHEET_MIME')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.INVALID_SHEET_MIME;
  }
  if (errString.includes('invalid_state') || errString.includes('csrf') || errString.includes('state_expired')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.CSRF_INVALID_STATE;
  }
  if (errString.includes('account_change_failed') || errString.includes('change_validation_failed')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.ACCOUNT_CHANGE_FAILED;
  }
  if (errString.includes('unauthenticated') || errString.includes('not_connected')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.NOT_CONNECTED;
  }
  if (errString.includes('token_expired') || errString.includes('invalid_grant') || errString.includes('reauth')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.REAUTH_REQUIRED;
  }
  if (errString.includes('permission_denied') || errString.includes('permission-denied') || errString.includes('unauthorized')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.PERMISSION_DENIED;
  }
  if (errString.includes('template_not_found') || errString.includes('404')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.TEMPLATE_NOT_FOUND;
  }
  if (errString.includes('template_access_denied') || errString.includes('403')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.TEMPLATE_ACCESS_DENIED;
  }
  if (errString.includes('network') || errString.includes('timeout') || errString.includes('fetch failed')) {
    return GOOGLE_WORKSPACE_USER_MESSAGES.GOOGLE_TEMPORARY_ERROR;
  }
  return GOOGLE_WORKSPACE_USER_MESSAGES.GOOGLE_TEMPORARY_ERROR;
}

export interface GoogleWorkspaceApiClient {
  callFunction<TRequest, TResponse>(name: string, data?: TRequest): Promise<TResponse>;
}

// Default in-memory or HTTPS callable dispatcher
let apiClient: GoogleWorkspaceApiClient = {
  async callFunction<TRequest, TResponse>(name: string, data?: TRequest): Promise<TResponse> {
    const response = await fetch(`/api/googleWorkspace/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ message: response.statusText }));
      throw new GoogleWorkspaceError(
        errBody.code || 'UNKNOWN_ERROR',
        mapGoogleWorkspaceErrorMessage(errBody.message || errBody.code)
      );
    }
    return response.json();
  },
};

export function setGoogleWorkspaceApiClient(customClient: GoogleWorkspaceApiClient) {
  apiClient = customClient;
}

/**
 * Retrieves the current Google Workspace connection status.
 */
export async function getGoogleConnectionStatus(): Promise<GoogleConnectionPublicInfo> {
  try {
    const publicDocRef = doc(db, 'system_settings', 'google_workspace_public');
    const snap = await getDoc(publicDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        state: (data.state as GoogleConnectionPublicInfo['state']) || 'disconnected',
        connectedEmail: data.connectedEmail || null,
        connectedAt: data.connectedAt || null,
        lastVerifiedAt: data.lastVerifiedAt || null,
        templateFormId: data.templateFormId || null,
        templateFormTitle: data.templateFormTitle || null,
      };
    }
  } catch {
    // If client direct read is unavailable, query backend function
  }

  try {
    return await apiClient.callFunction<void, GoogleConnectionPublicInfo>('getGoogleConnectionStatus');
  } catch {
    return {
      state: 'disconnected',
      connectedEmail: null,
    };
  }
}

/**
 * Requests an OAuth 2.0 authorization URL with CSRF state token.
 */
export async function requestGoogleAuthUrl(
  mode: 'connect' | 'reconnect' | 'change' = 'connect',
  redirectUri?: string
): Promise<GoogleAuthUrlResponse> {
  try {
    return await apiClient.callFunction<{ mode: string; redirectUri?: string }, GoogleAuthUrlResponse>(
      'getGoogleAuthUrl',
      redirectUri ? { mode, redirectUri } : { mode }
    );
  } catch (error) {
    throw new GoogleWorkspaceError(
      'AUTH_URL_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Exchanges the authorization code and validates CSRF state.
 */
export async function exchangeGoogleAuthCode(
  params: GoogleAuthExchangeRequest
): Promise<GoogleAuthExchangeResponse> {
  try {
    return await apiClient.callFunction<GoogleAuthExchangeRequest, GoogleAuthExchangeResponse>(
      'exchangeGoogleAuthCode',
      params
    );
  } catch (error) {
    throw new GoogleWorkspaceError(
      'CODE_EXCHANGE_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Reconnects an existing Google Workspace account.
 */
export async function reconnectGoogle(
  params: Omit<GoogleAuthExchangeRequest, 'mode'>
): Promise<GoogleAuthExchangeResponse> {
  return exchangeGoogleAuthCode({
    ...params,
    mode: 'reconnect',
  });
}

/**
 * Changes the active Google Workspace account with safe transactional replacement.
 */
export async function changeGoogleAccount(
  params: Omit<GoogleAuthExchangeRequest, 'mode'>
): Promise<GoogleAuthExchangeResponse> {
  return exchangeGoogleAuthCode({
    ...params,
    mode: 'change',
  });
}

/**
 * Disconnects the active Google Workspace integration, revokes Google tokens, and resets settings.
 */
export async function disconnectGoogleConnection(): Promise<GoogleDisconnectResponse> {
  try {
    return await apiClient.callFunction<void, GoogleDisconnectResponse>('disconnectGoogleConnection');
  } catch (error) {
    throw new GoogleWorkspaceError(
      'DISCONNECT_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Requests a short-lived access token for running the Google Picker in-memory.
 * Never persists token to storage.
 */
export async function getPickerAccessToken(): Promise<GooglePickerTokenResponse> {
  try {
    return await apiClient.callFunction<void, GooglePickerTokenResponse>('getGooglePickerToken');
  } catch (error) {
    throw new GoogleWorkspaceError(
      'PICKER_TOKEN_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Validates a Form selected via Picker and updates template settings.
 */
export async function validateAndSetFormTemplate(formId: string): Promise<ValidateTemplateResponse> {
  try {
    return await apiClient.callFunction<{ formId: string }, ValidateTemplateResponse>(
      'validateAndSetFormTemplate',
      { formId }
    );
  } catch (error) {
    throw new GoogleWorkspaceError(
      'VALIDATE_TEMPLATE_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Inspects a Google Sheet selected via Picker and extracts metadata + tabs.
 */
export async function inspectAndValidateSheet(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  try {
    return await apiClient.callFunction<{ spreadsheetId: string }, SpreadsheetMetadata>(
      'inspectAndValidateSheet',
      { spreadsheetId }
    );
  } catch (error) {
    throw new GoogleWorkspaceError(
      'INSPECT_SHEET_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Fetches 2D attendance rows from a Google Sheet tab.
 */
export async function fetchSheetAttendanceValues(
  spreadsheetId: string,
  sheetId: number
): Promise<{ spreadsheetId: string; sheetId: number; tabTitle: string; values: string[][] }> {
  try {
    return await apiClient.callFunction<
      { spreadsheetId: string; sheetId: number },
      { spreadsheetId: string; sheetId: number; tabTitle: string; values: string[][] }
    >('fetchSheetAttendanceData', { spreadsheetId, sheetId });
  } catch (error) {
    throw new GoogleWorkspaceError(
      'FETCH_SHEET_DATA_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Saves the chosen Google Sheet and tab as the current meeting attendance source.
 * Records provenance (sourceType: 'manual_sheet').
 * Crucial: Does NOT modify or sync attendees. Only sets the source metadata.
 */
export async function saveCurrentSheetSource(sourceInfo: CurrentSheetSourceInfo): Promise<void> {
  try {
    const docRef = doc(db, 'system_settings', 'current_meeting_source');
    await setDoc(docRef, {
      sourceType: sourceInfo.sourceType || 'manual_sheet',
      spreadsheetId: sourceInfo.spreadsheetId,
      spreadsheetTitle: sourceInfo.spreadsheetTitle,
      sheetId: sourceInfo.sheetId ?? 0,
      tabTitle: sourceInfo.tabTitle || 'Sheet1',
      selectedAt: sourceInfo.selectedAt || new Date().toISOString(),
      selectedBy: auth.currentUser?.email || sourceInfo.selectedBy || null,
      surveyId: sourceInfo.surveyId || null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save current sheet source:', error);
    throw new GoogleWorkspaceError(
      'SAVE_SOURCE_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}

/**
 * Retrieves the currently selected Google Sheet and tab for meeting attendance.
 */
export async function getCurrentSheetSource(): Promise<CurrentSheetSourceInfo | null> {
  try {
    const docRef = doc(db, 'system_settings', 'current_meeting_source');
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      sourceType: (data.sourceType as CurrentSheetSourceInfo['sourceType']) || 'manual_sheet',
      spreadsheetId: data.spreadsheetId,
      spreadsheetTitle: data.spreadsheetTitle,
      sheetId: data.sheetId ?? 0,
      tabTitle: data.tabTitle || 'Sheet1',
      selectedAt: data.selectedAt || new Date().toISOString(),
      selectedBy: data.selectedBy || null,
      surveyId: data.surveyId || null,
    };
  } catch (error) {
    console.error('Failed to fetch current sheet source:', error);
    return null;
  }
}

export interface CreateDailySurveyResponse {
  success: boolean;
  surveyId: string;
  formId: string;
  formTitle: string;
  formResponderUrl: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetId: number;
  tabTitle: string;
}

/**
 * Creates a daily meeting survey form and linked response spreadsheet.
 */
export async function createDailyMeetingSurvey(
  surveyTitle: string,
  clientRequestId?: string
): Promise<CreateDailySurveyResponse> {
  try {
    return await apiClient.callFunction<
      { surveyTitle: string; clientRequestId?: string },
      CreateDailySurveyResponse
    >('createDailyMeetingSurvey', {
      surveyTitle,
      clientRequestId: clientRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });
  } catch (error) {
    throw new GoogleWorkspaceError(
      'CREATE_SURVEY_ERROR',
      mapGoogleWorkspaceErrorMessage(error)
    );
  }
}


