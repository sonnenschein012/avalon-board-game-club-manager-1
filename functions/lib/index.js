"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDailyMeetingSurvey = exports.fetchSheetAttendanceData = exports.inspectAndValidateSheet = exports.validateAndSetFormTemplate = exports.getGooglePickerToken = exports.disconnectGoogleConnection = exports.getGoogleConnectionStatus = exports.exchangeGoogleAuthCode = exports.getGoogleAuthUrl = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const googleOAuth_1 = require("./googleOAuth");
const tokenStore_1 = require("./tokenStore");
const oauthStateStore_1 = require("./oauthStateStore");
const secrets_1 = require("./secrets");
const driveService_1 = require("./driveService");
const surveyService_1 = require("./surveyService");
// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const tokenStore = new tokenStore_1.TokenStore(db);
const oauthStateStore = new oauthStateStore_1.OAuthStateStore(db);
const functionsOptions = {
    secrets: [secrets_1.googleClientIdSecret, secrets_1.googleClientSecretSecret],
};
/**
 * 1. getGoogleAuthUrl
 * Generates an OAuth 2.0 authorization URL with CSRF state token.
 * Requires: Master Admin authentication.
 */
exports.getGoogleAuthUrl = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isMaster = await tokenStore.isMasterAdmin(callerEmail);
    if (!isMaster) {
        throw new https_1.HttpsError('permission-denied', 'Only Master Admins can initiate Google account connection.');
    }
    const mode = request.data?.mode || 'connect';
    const redirectUri = request.data?.redirectUri;
    // Generate and store CSRF state bound to caller email
    const state = await oauthStateStore.generateAndSaveState(callerEmail, mode);
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)(redirectUri ? { redirectUri } : undefined);
    const authUrl = (0, googleOAuth_1.generateAuthUrl)(oauth2Client, state);
    return { authUrl, state };
});
/**
 * 2. exchangeGoogleAuthCode
 * Validates CSRF state, exchanges authorization code for tokens, and performs safe account saving/changing.
 * Requires: Master Admin authentication.
 */
exports.exchangeGoogleAuthCode = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isMaster = await tokenStore.isMasterAdmin(callerEmail);
    if (!isMaster) {
        throw new https_1.HttpsError('permission-denied', 'Only Master Admins can connect or change Google accounts.');
    }
    const { code, state, redirectUri } = request.data || {};
    if (!code) {
        throw new https_1.HttpsError('invalid-argument', 'Authorization code is required.');
    }
    // CSRF Protection: Validate and consume state token
    const stateValidation = await oauthStateStore.validateAndConsumeState(state, callerEmail);
    if (!stateValidation.valid) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid or expired OAuth state token (CSRF validation failed).');
    }
    const mode = stateValidation.mode;
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)(redirectUri ? { redirectUri } : undefined);
    try {
        const { tokens, email } = await (0, googleOAuth_1.exchangeCodeForTokens)(oauth2Client, code);
        if (!tokens.refresh_token) {
            console.warn('No refresh token returned in token response');
        }
        const scopes = tokens.scope ? tokens.scope.split(' ') : [];
        if (mode === 'change') {
            // Safe Account Change: Validate before replacing active credentials
            await tokenStore.safeReplaceAccount(tokens.refresh_token || '', email, callerEmail, scopes);
        }
        else {
            await tokenStore.saveRefreshToken(tokens.refresh_token || '', email, callerEmail, scopes);
        }
        return {
            success: true,
            connectedEmail: email,
            mode,
        };
    }
    catch (error) {
        console.error('Failed to exchange Google auth code:', error);
        throw new https_1.HttpsError('internal', 'Failed to exchange authorization code.');
    }
});
/**
 * 3. getGoogleConnectionStatus
 * Returns the current public connection status. Access token temporary expiration
 * does NOT flip state to expired if refresh token remains valid.
 * Requires: Admin authentication.
 */
exports.getGoogleConnectionStatus = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isAdminUser = await tokenStore.isAdmin(callerEmail);
    if (!isAdminUser) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
    const publicStatus = await tokenStore.getPublicStatus();
    if (publicStatus.state !== 'connected' && publicStatus.state !== 'reauth_required') {
        return publicStatus;
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        await tokenStore.markTokenReauthRequired();
        return { ...publicStatus, state: 'reauth_required' };
    }
    // Verify token validity by attempting background refresh
    try {
        const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
        await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
        await tokenStore.markTokenValid();
        return { ...publicStatus, state: 'connected' };
    }
    catch (error) {
        console.warn('Google token refresh check failed (reauth required):', error);
        await tokenStore.markTokenReauthRequired();
        return { ...publicStatus, state: 'reauth_required' };
    }
});
/**
 * 4. disconnectGoogleConnection
 * Revokes Google tokens on Google's authorization servers and resets local integration settings.
 * Requires: Master Admin authentication.
 */
exports.disconnectGoogleConnection = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isMaster = await tokenStore.isMasterAdmin(callerEmail);
    if (!isMaster) {
        throw new https_1.HttpsError('permission-denied', 'Only Master Admins can disconnect Google account.');
    }
    let revocationAttempted = false;
    let revocationSucceeded = false;
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (refreshToken) {
        revocationAttempted = true;
        const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
        revocationSucceeded = await (0, googleOAuth_1.revokeToken)(oauth2Client, refreshToken);
    }
    await tokenStore.removeIntegration(callerEmail);
    return {
        success: true,
        revocationAttempted,
        revocationSucceeded,
    };
});
/**
 * 5. getGooglePickerToken
 * Issues a short-lived access token strictly for running the Google Picker in browser memory.
 * Never persists refresh token on client.
 * Requires: Admin authentication.
 */
exports.getGooglePickerToken = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isAdminUser = await tokenStore.isAdmin(callerEmail);
    if (!isAdminUser) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Google 계정을 연결해주세요.');
    }
    try {
        const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
        const credentials = await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
        const accessToken = credentials.access_token;
        if (!accessToken) {
            throw new Error('No access token returned');
        }
        return {
            accessToken,
            expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
        };
    }
    catch (error) {
        console.error('Failed to issue Picker access token:', error);
        throw new https_1.HttpsError('unauthenticated', 'Google 연결을 다시 확인해야 합니다.');
    }
});
/**
 * 6. validateAndSetFormTemplate
 * Validates a Google Form file selected via Picker and persists it as the meeting survey template.
 * Requires: Master Admin authentication.
 */
exports.validateAndSetFormTemplate = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isMaster = await tokenStore.isMasterAdmin(callerEmail);
    if (!isMaster) {
        throw new https_1.HttpsError('permission-denied', 'Only Master Admins can configure the meeting survey template.');
    }
    const { formId } = request.data || {};
    if (!formId) {
        throw new https_1.HttpsError('invalid-argument', 'Form ID is required.');
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Google 계정을 연결해주세요.');
    }
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
    await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
    const validation = await (0, driveService_1.validateFormTemplateFile)(formId, oauth2Client);
    if (!validation.valid) {
        throw new https_1.HttpsError('invalid-argument', validation.errorMessage || '유효하지 않은 설문지입니다.');
    }
    await tokenStore.setTemplateForm(validation.formId, validation.title);
    return {
        success: true,
        formId: validation.formId,
        title: validation.title,
    };
});
/**
 * 7. inspectAndValidateSheet
 * Inspects a Google Spreadsheet file selected via Picker and returns metadata + sheet tabs.
 * Requires: Admin authentication.
 */
exports.inspectAndValidateSheet = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isAdminUser = await tokenStore.isAdmin(callerEmail);
    if (!isAdminUser) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
    const { spreadsheetId } = request.data || {};
    if (!spreadsheetId) {
        throw new https_1.HttpsError('invalid-argument', 'Spreadsheet ID is required.');
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Google 계정을 연결해주세요.');
    }
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
    await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
    const inspection = await (0, driveService_1.inspectSpreadsheetFile)(spreadsheetId, oauth2Client);
    if (!inspection.valid) {
        throw new https_1.HttpsError('invalid-argument', inspection.errorMessage || '스프레드시트를 읽을 수 없습니다.');
    }
    return {
        success: true,
        spreadsheetId: inspection.spreadsheetId,
        title: inspection.title,
        tabs: inspection.tabs,
        defaultTabId: inspection.defaultTabId,
    };
});
/**
 * 8. fetchSheetAttendanceData
 * Fetches 2D rows from a Google Sheet tab identified by immutable sheetId.
 * Requires: Admin authentication.
 */
exports.fetchSheetAttendanceData = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isAdminUser = await tokenStore.isAdmin(callerEmail);
    if (!isAdminUser) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
    const { spreadsheetId, sheetId } = request.data || {};
    if (!spreadsheetId) {
        throw new https_1.HttpsError('invalid-argument', 'Spreadsheet ID is required.');
    }
    if (typeof sheetId !== 'number') {
        throw new https_1.HttpsError('invalid-argument', 'Sheet ID (number) is required.');
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        throw new https_1.HttpsError('failed-precondition', 'Google 계정을 연결해주세요.');
    }
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
    await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
    const result = await (0, driveService_1.fetchSpreadsheetValuesByTabId)(spreadsheetId, sheetId, oauth2Client);
    if (!result.success) {
        throw new https_1.HttpsError('invalid-argument', result.errorMessage || '스프레드시트 데이터를 읽을 수 없습니다.');
    }
    return {
        success: true,
        spreadsheetId: result.spreadsheetId,
        sheetId: result.sheetId,
        tabTitle: result.tabTitle,
        values: result.values,
    };
});
/**
 * 9. createDailyMeetingSurvey
 * Clones the configured Form template, creates a linked response Spreadsheet,
 * binds destination, verifies responder URL, and automatically sets current_meeting_source.
 * Requires: Admin authentication.
 */
exports.createDailyMeetingSurvey = (0, https_1.onCall)(functionsOptions, async (request) => {
    const callerEmail = request.auth?.token?.email;
    if (!callerEmail) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const isAdminUser = await tokenStore.isAdmin(callerEmail);
    if (!isAdminUser) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
    const { surveyTitle, clientRequestId: rawRequestId } = request.data || {};
    if (!surveyTitle || typeof surveyTitle !== 'string' || !surveyTitle.trim()) {
        throw new https_1.HttpsError('invalid-argument', '설문 제목을 입력해주세요.');
    }
    const clientRequestId = rawRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const reqDocRef = db.doc(`survey_creation_requests/${clientRequestId}`);
    // Idempotency check via Firestore transaction
    const shouldProceed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(reqDocRef);
        if (snap.exists) {
            const data = snap.data() || {};
            if (data.status === 'ready') {
                return { proceed: false, existingResult: data.result };
            }
            if (data.status === 'creating') {
                throw new https_1.HttpsError('already-exists', '동일한 설문 생성 요청이 이미 처리 중입니다.');
            }
        }
        tx.set(reqDocRef, {
            clientRequestId,
            surveyTitle: surveyTitle.trim(),
            status: 'creating',
            createdAt: new Date().toISOString(),
            createdBy: callerEmail,
        });
        return { proceed: true };
    });
    if (!shouldProceed.proceed && shouldProceed.existingResult) {
        return shouldProceed.existingResult;
    }
    const publicSnap = await db.doc('system_settings/google_workspace_public').get();
    const publicData = publicSnap.data() || {};
    const templateFormId = publicData.templateFormId;
    if (!templateFormId) {
        await reqDocRef.update({ status: 'failed', errorMessage: '설정된 설문 템플릿이 없습니다.' });
        throw new https_1.HttpsError('failed-precondition', '설정된 설문 템플릿이 없습니다. 먼저 마스터 관리자가 Form 템플릿을 설정해주세요.');
    }
    const { refreshToken } = await tokenStore.getRefreshToken();
    if (!refreshToken) {
        await reqDocRef.update({ status: 'failed', errorMessage: 'Google 계정을 연결해주세요.' });
        throw new https_1.HttpsError('failed-precondition', 'Google 계정을 연결해주세요.');
    }
    const oauth2Client = (0, googleOAuth_1.getGoogleOAuth2Client)();
    await (0, googleOAuth_1.refreshAccessToken)(oauth2Client, refreshToken);
    const surveyId = `survey_${Date.now()}`;
    const surveyDocRef = db.doc(`meeting_surveys/${surveyId}`);
    // Set initial creating state
    await surveyDocRef.set({
        id: surveyId,
        title: surveyTitle.trim(),
        templateFormId,
        formId: '',
        formResponderUrl: '',
        spreadsheetId: '',
        status: 'creating',
        createdAt: new Date().toISOString(),
        createdBy: callerEmail,
    });
    const result = await (0, surveyService_1.createAndLinkDailyMeetingSurvey)({
        templateFormId,
        surveyTitle: surveyTitle.trim(),
        callerEmail,
        authClient: oauth2Client,
    });
    if (!result.success) {
        await surveyDocRef.update({
            status: 'failed',
            errorMessage: result.errorMessage || '설문 생성 중 오류가 발생했습니다.',
            failedAt: new Date().toISOString(),
        });
        throw new https_1.HttpsError('internal', result.errorMessage || '설문 생성 및 스프레드시트 연결에 실패했습니다.');
    }
    const resultPayload = {
        success: true,
        surveyId,
        formId: result.formId,
        formTitle: result.formTitle,
        formResponderUrl: result.formResponderUrl,
        spreadsheetId: result.spreadsheetId,
        spreadsheetTitle: result.spreadsheetTitle,
        sheetId: result.responseSheetId,
        tabTitle: result.responseSheetTitle,
    };
    // Success: Update meeting survey record, request idempotency doc, and atomically link current_meeting_source
    const batch = db.batch();
    batch.set(surveyDocRef, {
        id: surveyId,
        title: result.formTitle,
        templateFormId,
        formId: result.formId,
        formResponderUrl: result.formResponderUrl,
        spreadsheetId: result.spreadsheetId,
        spreadsheetTitle: result.spreadsheetTitle,
        responseSheetId: result.responseSheetId,
        responseSheetName: result.responseSheetTitle,
        status: 'ready',
        createdAt: new Date().toISOString(),
        createdBy: callerEmail,
    }, { merge: true });
    batch.set(reqDocRef, {
        status: 'ready',
        result: resultPayload,
        completedAt: new Date().toISOString(),
    }, { merge: true });
    const sourceDocRef = db.doc('system_settings/current_meeting_source');
    batch.set(sourceDocRef, {
        sourceType: 'generated_form',
        spreadsheetId: result.spreadsheetId,
        spreadsheetTitle: result.spreadsheetTitle,
        sheetId: result.responseSheetId,
        tabTitle: result.responseSheetTitle,
        selectedAt: new Date().toISOString(),
        selectedBy: callerEmail,
        surveyId,
    }, { merge: true });
    await batch.commit();
    return resultPayload;
});
//# sourceMappingURL=index.js.map