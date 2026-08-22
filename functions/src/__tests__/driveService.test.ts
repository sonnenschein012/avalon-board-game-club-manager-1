import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateFormTemplateFile,
  inspectSpreadsheetFile,
  fetchSpreadsheetValuesByTabId,
} from '../driveService';
import { google } from 'googleapis';

describe('driveService backend validation & sheet fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFormTemplateFile', () => {
    it('validates a valid Google Form file successfully', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              id: 'form_123',
              name: '아발론 정기모임 참석 조사 TEMPLATE',
              mimeType: 'application/vnd.google-apps.form',
              trashed: false,
            },
          }),
        },
      };

      vi.spyOn(google, 'drive').mockReturnValue(mockDrive as any);

      const res = await validateFormTemplateFile('form_123', {} as any);
      expect(res.valid).toBe(true);
      expect(res.formId).toBe('form_123');
      expect(res.title).toBe('아발론 정기모임 참석 조사 TEMPLATE');
    });

    it('rejects non-form files (e.g. spreadsheet chosen by mistake)', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              id: 'sheet_456',
              name: '출석부',
              mimeType: 'application/vnd.google-apps.spreadsheet',
              trashed: false,
            },
          }),
        },
      };

      vi.spyOn(google, 'drive').mockReturnValue(mockDrive as any);

      const res = await validateFormTemplateFile('sheet_456', {} as any);
      expect(res.valid).toBe(false);
      expect(res.errorMessage).toContain('Google 설문지');
    });

    it('rejects trashed or missing files', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              id: 'trashed_789',
              name: '삭제된 설문지',
              mimeType: 'application/vnd.google-apps.form',
              trashed: true,
            },
          }),
        },
      };

      vi.spyOn(google, 'drive').mockReturnValue(mockDrive as any);

      const res = await validateFormTemplateFile('trashed_789', {} as any);
      expect(res.valid).toBe(false);
      expect(res.errorMessage).toContain('찾을 수 없습니다');
    });
  });

  describe('inspectSpreadsheetFile', () => {
    it('inspects valid spreadsheet and parses multiple tabs correctly', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValueOnce({
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
          get: vi.fn().mockResolvedValueOnce({
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

      vi.spyOn(google, 'drive').mockReturnValue(mockDrive as any);
      vi.spyOn(google, 'sheets').mockReturnValue(mockSheets as any);

      const res = await inspectSpreadsheetFile('sheet_abc', {} as any);
      expect(res.valid).toBe(true);
      expect(res.title).toBe('2026-2학기 출석 응답');
      expect(res.tabs).toHaveLength(2);
      expect(res.tabs[0]?.title).toBe('설문지 응답 시트 1');
      expect(res.tabs[1]?.sheetId).toBe(12345);
    });

    it('rejects non-spreadsheet MIME types', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              id: 'doc_xyz',
              name: '회칙 문서',
              mimeType: 'application/vnd.google-apps.document',
              trashed: false,
            },
          }),
        },
      };

      vi.spyOn(google, 'drive').mockReturnValue(mockDrive as any);

      const res = await inspectSpreadsheetFile('doc_xyz', {} as any);
      expect(res.valid).toBe(false);
      expect(res.errorMessage).toContain('Google 스프레드시트');
    });
  });

  describe('fetchSpreadsheetValuesByTabId', () => {
    it('resolves tab title by immutable sheetId and fetches rows', async () => {
      const mockSheets = {
        spreadsheets: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              sheets: [
                { properties: { sheetId: 999, title: '설문지 응답 시트 1' } },
              ],
            },
          }),
          values: {
            get: vi.fn().mockResolvedValueOnce({
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

      vi.spyOn(google, 'sheets').mockReturnValue(mockSheets as any);

      const res = await fetchSpreadsheetValuesByTabId('sheet_123', 999, {} as any);
      expect(res.success).toBe(true);
      expect(res.tabTitle).toBe('설문지 응답 시트 1');
      expect(res.values).toHaveLength(3);
      expect(res.values[1]?.[1]).toBe('25 김아발');
    });

    it('returns failure when sheetId does not exist in spreadsheet', async () => {
      const mockSheets = {
        spreadsheets: {
          get: vi.fn().mockResolvedValueOnce({
            data: {
              sheets: [
                { properties: { sheetId: 0, title: 'Sheet1' } },
              ],
            },
          }),
        },
      };

      vi.spyOn(google, 'sheets').mockReturnValue(mockSheets as any);

      const res = await fetchSpreadsheetValuesByTabId('sheet_123', 8888, {} as any);
      expect(res.success).toBe(false);
      expect(res.errorMessage).toContain('선택된 탭을 스프레드시트에서 찾을 수 없습니다');
    });
  });
});
