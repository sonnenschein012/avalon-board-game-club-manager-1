import { useCallback } from 'react';
import {
  requestGoogleAuthUrl,
  exchangeGoogleAuthCode,
  reconnectGoogle,
  changeGoogleAccount,
  disconnectGoogleConnection,
  validateAndSetFormTemplate,
  inspectAndValidateSheet,
  saveCurrentSheetSource,
  createDailyMeetingSurvey,
  CreateDailySurveyResponse,
} from '../services/googleWorkspaceService';
import type { CurrentSheetSourceInfo, GoogleAuthExchangeRequest } from '../types/googleWorkspace';

export function useGoogleWorkspace() {
  const handleRequestAuthUrl = useCallback(async (mode: 'connect' | 'reconnect' | 'change' = 'connect') => {
    return await requestGoogleAuthUrl(mode);
  }, []);

  const handleExchangeAuthCode = useCallback(async (params: GoogleAuthExchangeRequest) => {
    return await exchangeGoogleAuthCode(params);
  }, []);

  const handleReconnect = useCallback(async (params: Omit<GoogleAuthExchangeRequest, 'mode'>) => {
    return await reconnectGoogle(params);
  }, []);

  const handleChangeAccount = useCallback(async (params: Omit<GoogleAuthExchangeRequest, 'mode'>) => {
    return await changeGoogleAccount(params);
  }, []);

  const handleDisconnect = useCallback(async () => {
    return await disconnectGoogleConnection();
  }, []);

  const handleSetFormTemplate = useCallback(async (formId: string) => {
    return await validateAndSetFormTemplate(formId);
  }, []);

  const handleInspectSheet = useCallback(async (spreadsheetId: string) => {
    return await inspectAndValidateSheet(spreadsheetId);
  }, []);

  const handleSaveSheetSource = useCallback(async (sourceInfo: CurrentSheetSourceInfo) => {
    return await saveCurrentSheetSource(sourceInfo);
  }, []);

  const handleCreateSurvey = useCallback(async (surveyTitle: string, clientRequestId?: string): Promise<CreateDailySurveyResponse> => {
    return await createDailyMeetingSurvey(surveyTitle, clientRequestId);
  }, []);

  return {
    handleRequestAuthUrl,
    handleExchangeAuthCode,
    handleReconnect,
    handleChangeAccount,
    handleDisconnect,
    handleSetFormTemplate,
    handleInspectSheet,
    handleSaveSheetSource,
    handleCreateSurvey,
  };
}
