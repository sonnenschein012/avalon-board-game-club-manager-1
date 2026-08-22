export type GoogleConnectionState = 'connected' | 'reauth_required' | 'disconnected';

export interface GoogleConnectionPublicInfo {
  state: GoogleConnectionState;
  connectedEmail: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  templateFormId?: string | null;
  templateFormTitle?: string | null;
}

export interface GoogleAuthUrlResponse {
  authUrl: string;
  state: string;
}

export interface GoogleAuthExchangeRequest {
  code: string;
  state: string;
  redirectUri?: string;
  mode?: 'connect' | 'reconnect' | 'change';
}

export interface GoogleAuthExchangeResponse {
  success: boolean;
  connectedEmail: string;
  mode: 'connect' | 'reconnect' | 'change';
}

export interface GoogleDisconnectResponse {
  success: boolean;
  revocationAttempted: boolean;
  revocationSucceeded: boolean;
}

export interface GooglePickerTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetMetadata {
  id: string;
  title: string;
  tabs: SheetTabInfo[];
  defaultTabId: number;
}

export type MeetingSheetSourceType = 'manual_sheet' | 'generated_form';

export interface CurrentSheetSourceInfo {
  sourceType: MeetingSheetSourceType;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetId: number;
  tabTitle: string;
  selectedAt: string;
  selectedBy?: string | null;
  surveyId?: string | null;
}

export interface ValidateTemplateResponse {
  success: boolean;
  formId: string;
  title: string;
}

export interface FormTemplateInfo {
  id: string;
  title: string;
  description?: string;
  responderUri?: string;
  isValidTemplate?: boolean;
}

export interface MeetingSurveyRecord {
  id: string;
  title: string;
  templateFormId: string;
  formId: string;
  formResponderUrl: string;
  spreadsheetId: string;
  responseSheetId?: number | null;
  responseSheetName?: string | null;
  googleAccountId?: string | null;
  createdAt: string;
  createdBy: string;
  status: 'creating' | 'ready' | 'failed';
  errorMessage?: string | null;
}
