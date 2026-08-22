"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFormTemplateFile = validateFormTemplateFile;
exports.inspectSpreadsheetFile = inspectSpreadsheetFile;
exports.fetchSpreadsheetValuesByTabId = fetchSpreadsheetValuesByTabId;
const googleapis_1 = require("googleapis");
/**
 * Validates a Google Form file for use as a recurring meeting survey template.
 */
async function validateFormTemplateFile(fileId, authClient) {
    const drive = googleapis_1.google.drive({ version: 'v3', auth: authClient });
    try {
        const res = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, capabilities, trashed',
            supportsAllDrives: true,
        });
        const file = res.data;
        if (!file || file.trashed) {
            return {
                valid: false,
                formId: fileId,
                title: '',
                errorMessage: '설정된 설문 템플릿을 찾을 수 없습니다. (휴지통에 있거나 삭제됨)',
            };
        }
        if (file.mimeType !== 'application/vnd.google-apps.form') {
            return {
                valid: false,
                formId: fileId,
                title: file.name || '',
                errorMessage: '선택한 파일이 Google 설문지(Google Forms) 형식이 아닙니다.',
            };
        }
        return {
            valid: true,
            formId: file.id || fileId,
            title: file.name || '제목 없는 설문지',
        };
    }
    catch (error) {
        console.error('Error validating Form template:', error);
        const status = error.status || error.code;
        if (status === 404) {
            return {
                valid: false,
                formId: fileId,
                title: '',
                errorMessage: '설정된 설문 템플릿을 찾을 수 없습니다.',
            };
        }
        if (status === 403) {
            return {
                valid: false,
                formId: fileId,
                title: '',
                errorMessage: '현재 계정으로 설문 템플릿에 접근할 수 없습니다.',
            };
        }
        return {
            valid: false,
            formId: fileId,
            title: '',
            errorMessage: 'Google 서비스에 일시적으로 연결할 수 없습니다.',
        };
    }
}
/**
 * Inspects a Google Spreadsheet file and extracts metadata and sheet tabs.
 */
async function inspectSpreadsheetFile(spreadsheetId, authClient) {
    const drive = googleapis_1.google.drive({ version: 'v3', auth: authClient });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth: authClient });
    try {
        const driveRes = await drive.files.get({
            fileId: spreadsheetId,
            fields: 'id, name, mimeType, trashed',
            supportsAllDrives: true,
        });
        const file = driveRes.data;
        if (!file || file.trashed) {
            return {
                valid: false,
                spreadsheetId,
                title: '',
                tabs: [],
                defaultTabId: 0,
                errorMessage: '스프레드시트를 찾을 수 없습니다.',
            };
        }
        if (file.mimeType !== 'application/vnd.google-apps.spreadsheet') {
            return {
                valid: false,
                spreadsheetId,
                title: file.name || '',
                tabs: [],
                defaultTabId: 0,
                errorMessage: '선택한 파일이 Google 스프레드시트(Google Sheets) 형식이 아닙니다.',
            };
        }
        const sheetsRes = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'properties.title,sheets.properties(sheetId,title,index)',
        });
        const sheetData = sheetsRes.data;
        const title = sheetData.properties?.title || file.name || '제목 없는 스프레드시트';
        const tabs = (sheetData.sheets || []).map((s, idx) => ({
            sheetId: s.properties?.sheetId ?? idx,
            title: s.properties?.title || `Sheet${idx + 1}`,
            index: s.properties?.index ?? idx,
        }));
        if (tabs.length === 0) {
            tabs.push({ sheetId: 0, title: 'Sheet1', index: 0 });
        }
        return {
            valid: true,
            spreadsheetId,
            title,
            tabs,
            defaultTabId: tabs[0]?.sheetId ?? 0,
        };
    }
    catch (error) {
        console.error('Error inspecting spreadsheet:', error);
        const status = error.status || error.code;
        if (status === 404 || status === 403) {
            return {
                valid: false,
                spreadsheetId,
                title: '',
                tabs: [],
                defaultTabId: 0,
                errorMessage: '현재 계정으로 이 응답 Sheet에 접근할 수 없습니다.',
            };
        }
        return {
            valid: false,
            spreadsheetId,
            title: '',
            tabs: [],
            defaultTabId: 0,
            errorMessage: 'Google 서비스에 일시적으로 연결할 수 없습니다.',
        };
    }
}
/**
 * Resolves tab title by immutable sheetId and fetches 2D sheet values.
 */
async function fetchSpreadsheetValuesByTabId(spreadsheetId, sheetId, authClient) {
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth: authClient });
    try {
        // 1. Resolve current tab title using immutable sheetId
        const metaRes = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties(sheetId,title)',
        });
        const matchedSheet = (metaRes.data.sheets || []).find((s) => s.properties?.sheetId === sheetId);
        if (!matchedSheet || !matchedSheet.properties?.title) {
            return {
                success: false,
                spreadsheetId,
                sheetId,
                tabTitle: '',
                values: [],
                errorMessage: '선택된 탭을 스프레드시트에서 찾을 수 없습니다. (삭제되었거나 변경됨)',
            };
        }
        const tabTitle = matchedSheet.properties.title;
        // 2. Fetch all rows in this tab (e.g. 'TabName'!A1:Z)
        // Escape single quotes in sheet title if any
        const escapedTabTitle = tabTitle.replace(/'/g, "''");
        const range = `'${escapedTabTitle}'!A1:Z`;
        const valuesRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption: 'FORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING',
        });
        const rawValues = (valuesRes.data.values || []);
        return {
            success: true,
            spreadsheetId,
            sheetId,
            tabTitle,
            values: rawValues,
        };
    }
    catch (error) {
        console.error('Error fetching spreadsheet values by sheetId:', error);
        const status = error.status || error.code;
        if (status === 404 || status === 403) {
            return {
                success: false,
                spreadsheetId,
                sheetId,
                tabTitle: '',
                values: [],
                errorMessage: '현재 계정으로 이 응답 Sheet에 접근할 수 없습니다.',
            };
        }
        return {
            success: false,
            spreadsheetId,
            sheetId,
            tabTitle: '',
            values: [],
            errorMessage: 'Google 서비스에 일시적으로 연결할 수 없습니다.',
        };
    }
}
//# sourceMappingURL=driveService.js.map