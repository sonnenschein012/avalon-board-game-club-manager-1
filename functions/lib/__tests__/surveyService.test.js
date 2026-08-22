"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const surveyService_1 = require("../surveyService");
const googleapis_1 = require("googleapis");
vitest_1.vi.mock('googleapis', () => {
    const mockDrive = {
        files: {
            copy: vitest_1.vi.fn(),
        },
    };
    const mockForms = {
        forms: {
            batchUpdate: vitest_1.vi.fn().mockResolvedValue({}),
            get: vitest_1.vi.fn(),
        },
    };
    const mockSheets = {
        spreadsheets: {
            create: vitest_1.vi.fn(),
            get: vitest_1.vi.fn(),
        },
    };
    const mockScript = {
        scripts: {
            run: vitest_1.vi.fn().mockResolvedValue({ data: {} }),
        },
    };
    return {
        google: {
            drive: vitest_1.vi.fn(() => mockDrive),
            forms: vitest_1.vi.fn(() => mockForms),
            sheets: vitest_1.vi.fn(() => mockSheets),
            script: vitest_1.vi.fn(() => mockScript),
        },
    };
});
(0, vitest_1.describe)('functions surveyService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('clones form template, creates response spreadsheet, identifies response tab and returns full metadata', async () => {
        const mockDrive = googleapis_1.google.drive();
        const mockForms = googleapis_1.google.forms();
        const mockSheets = googleapis_1.google.sheets();
        // 1. Mock Drive files.copy
        mockDrive.files.copy.mockResolvedValueOnce({
            data: {
                id: 'new_form_789',
                name: '2026-08-22 정기모임 참석 조사',
            },
        });
        // 2. Mock Forms forms.get
        mockForms.forms.get.mockResolvedValueOnce({
            data: {
                formId: 'new_form_789',
                responderUri: 'https://docs.google.com/forms/d/e/new_form_789/viewform',
            },
        });
        // 3. Mock Sheets spreadsheets.create
        mockSheets.spreadsheets.create.mockResolvedValueOnce({
            data: {
                spreadsheetId: 'new_sheet_456',
            },
        });
        // 4. Mock Sheets spreadsheets.get for tab inspection
        mockSheets.spreadsheets.get.mockResolvedValueOnce({
            data: {
                properties: { title: '[설문 응답] 2026-08-22 정기모임 참석 조사' },
                sheets: [
                    { properties: { sheetId: 101, title: '설문지 응답 시트 1', index: 0 } },
                ],
            },
        });
        const result = await (0, surveyService_1.createAndLinkDailyMeetingSurvey)({
            templateFormId: 'template_form_111',
            surveyTitle: '2026-08-22 정기모임 참석 조사',
            callerEmail: 'admin@avalon.club',
            authClient: {},
        });
        (0, vitest_1.expect)(result.success).toBe(true);
        (0, vitest_1.expect)(result.formId).toBe('new_form_789');
        (0, vitest_1.expect)(result.formTitle).toBe('2026-08-22 정기모임 참석 조사');
        (0, vitest_1.expect)(result.formResponderUrl).toBe('https://docs.google.com/forms/d/e/new_form_789/viewform');
        (0, vitest_1.expect)(result.spreadsheetId).toBe('new_sheet_456');
        (0, vitest_1.expect)(result.responseSheetId).toBe(101);
        (0, vitest_1.expect)(result.responseSheetTitle).toBe('설문지 응답 시트 1');
    });
    (0, vitest_1.it)('handles Drive copy failure gracefully', async () => {
        const mockDrive = googleapis_1.google.drive();
        mockDrive.files.copy.mockRejectedValueOnce(new Error('Drive quota exceeded'));
        const result = await (0, surveyService_1.createAndLinkDailyMeetingSurvey)({
            templateFormId: 'template_form_111',
            surveyTitle: '2026-08-22 정기모임 참석 조사',
            callerEmail: 'admin@avalon.club',
            authClient: {},
        });
        (0, vitest_1.expect)(result.success).toBe(false);
        (0, vitest_1.expect)(result.errorMessage).toContain('Drive quota exceeded');
    });
});
//# sourceMappingURL=surveyService.test.js.map