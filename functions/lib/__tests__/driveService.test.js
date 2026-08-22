"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const driveService_1 = require("../driveService");
const googleapis_1 = require("googleapis");
(0, vitest_1.describe)('driveService backend validation & sheet fetching', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('validateFormTemplateFile', () => {
        (0, vitest_1.it)('validates a valid Google Form file successfully', async () => {
            const mockDrive = {
                files: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'form_123',
                            name: '아발론 정기모임 참석 조사 TEMPLATE',
                            mimeType: 'application/vnd.google-apps.form',
                            trashed: false,
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'drive').mockReturnValue(mockDrive);
            const res = await (0, driveService_1.validateFormTemplateFile)('form_123', {});
            (0, vitest_1.expect)(res.valid).toBe(true);
            (0, vitest_1.expect)(res.formId).toBe('form_123');
            (0, vitest_1.expect)(res.title).toBe('아발론 정기모임 참석 조사 TEMPLATE');
        });
        (0, vitest_1.it)('rejects non-form files (e.g. spreadsheet chosen by mistake)', async () => {
            const mockDrive = {
                files: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'sheet_456',
                            name: '출석부',
                            mimeType: 'application/vnd.google-apps.spreadsheet',
                            trashed: false,
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'drive').mockReturnValue(mockDrive);
            const res = await (0, driveService_1.validateFormTemplateFile)('sheet_456', {});
            (0, vitest_1.expect)(res.valid).toBe(false);
            (0, vitest_1.expect)(res.errorMessage).toContain('Google 설문지');
        });
        (0, vitest_1.it)('rejects trashed or missing files', async () => {
            const mockDrive = {
                files: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'trashed_789',
                            name: '삭제된 설문지',
                            mimeType: 'application/vnd.google-apps.form',
                            trashed: true,
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'drive').mockReturnValue(mockDrive);
            const res = await (0, driveService_1.validateFormTemplateFile)('trashed_789', {});
            (0, vitest_1.expect)(res.valid).toBe(false);
            (0, vitest_1.expect)(res.errorMessage).toContain('찾을 수 없습니다');
        });
    });
    (0, vitest_1.describe)('inspectSpreadsheetFile', () => {
        (0, vitest_1.it)('inspects valid spreadsheet and parses multiple tabs correctly', async () => {
            const mockDrive = {
                files: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'sheet_abc',
                            name: '2026-2학기 출석 응답',
                            mimeType: 'application/vnd.google-apps.spreadsheet',
                            trashed: false,
                        },
                    }),
                },
            };
            const mockSheets = {
                spreadsheets: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            properties: { title: '2026-2학기 출석 응답' },
                            sheets: [
                                { properties: { sheetId: 0, title: '설문지 응답 시트 1', index: 0 } },
                                { properties: { sheetId: 12345, title: '참석자 정제', index: 1 } },
                            ],
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'drive').mockReturnValue(mockDrive);
            vitest_1.vi.spyOn(googleapis_1.google, 'sheets').mockReturnValue(mockSheets);
            const res = await (0, driveService_1.inspectSpreadsheetFile)('sheet_abc', {});
            (0, vitest_1.expect)(res.valid).toBe(true);
            (0, vitest_1.expect)(res.title).toBe('2026-2학기 출석 응답');
            (0, vitest_1.expect)(res.tabs).toHaveLength(2);
            (0, vitest_1.expect)(res.tabs[0]?.title).toBe('설문지 응답 시트 1');
            (0, vitest_1.expect)(res.tabs[1]?.sheetId).toBe(12345);
        });
        (0, vitest_1.it)('rejects non-spreadsheet MIME types', async () => {
            const mockDrive = {
                files: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            id: 'doc_xyz',
                            name: '회칙 문서',
                            mimeType: 'application/vnd.google-apps.document',
                            trashed: false,
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'drive').mockReturnValue(mockDrive);
            const res = await (0, driveService_1.inspectSpreadsheetFile)('doc_xyz', {});
            (0, vitest_1.expect)(res.valid).toBe(false);
            (0, vitest_1.expect)(res.errorMessage).toContain('Google 스프레드시트');
        });
    });
    (0, vitest_1.describe)('fetchSpreadsheetValuesByTabId', () => {
        (0, vitest_1.it)('resolves tab title by immutable sheetId and fetches rows', async () => {
            const mockSheets = {
                spreadsheets: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            sheets: [
                                { properties: { sheetId: 999, title: '설문지 응답 시트 1' } },
                            ],
                        },
                    }),
                    values: {
                        get: vitest_1.vi.fn().mockResolvedValueOnce({
                            data: {
                                values: [
                                    ['타임스탬프', '학번 및 이름', '마시고 싶은 음료', '뒷풀이 여부'],
                                    ['2026. 8. 22 오후 6:00:00', '25 김아발', '콜라', '참석'],
                                    ['2026. 8. 22 오후 6:01:00', '24 이보드', '사이다', '미참석'],
                                ],
                            },
                        }),
                    },
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'sheets').mockReturnValue(mockSheets);
            const res = await (0, driveService_1.fetchSpreadsheetValuesByTabId)('sheet_123', 999, {});
            (0, vitest_1.expect)(res.success).toBe(true);
            (0, vitest_1.expect)(res.tabTitle).toBe('설문지 응답 시트 1');
            (0, vitest_1.expect)(res.values).toHaveLength(3);
            (0, vitest_1.expect)(res.values[1]?.[1]).toBe('25 김아발');
        });
        (0, vitest_1.it)('returns failure when sheetId does not exist in spreadsheet', async () => {
            const mockSheets = {
                spreadsheets: {
                    get: vitest_1.vi.fn().mockResolvedValueOnce({
                        data: {
                            sheets: [
                                { properties: { sheetId: 0, title: 'Sheet1' } },
                            ],
                        },
                    }),
                },
            };
            vitest_1.vi.spyOn(googleapis_1.google, 'sheets').mockReturnValue(mockSheets);
            const res = await (0, driveService_1.fetchSpreadsheetValuesByTabId)('sheet_123', 8888, {});
            (0, vitest_1.expect)(res.success).toBe(false);
            (0, vitest_1.expect)(res.errorMessage).toContain('선택된 탭을 스프레드시트에서 찾을 수 없습니다');
        });
    });
});
//# sourceMappingURL=driveService.test.js.map