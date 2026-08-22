import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAndLinkDailyMeetingSurvey } from '../surveyService';
import { google } from 'googleapis';

vi.mock('googleapis', () => {
  const mockDrive = {
    files: {
      copy: vi.fn(),
    },
  };
  const mockForms = {
    forms: {
      batchUpdate: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
    },
  };
  const mockSheets = {
    spreadsheets: {
      create: vi.fn(),
      get: vi.fn(),
    },
  };
  const mockScript = {
    scripts: {
      run: vi.fn().mockResolvedValue({ data: {} }),
    },
  };

  return {
    google: {
      drive: vi.fn(() => mockDrive),
      forms: vi.fn(() => mockForms),
      sheets: vi.fn(() => mockSheets),
      script: vi.fn(() => mockScript),
    },
  };
});

describe('functions surveyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clones form template, creates response spreadsheet, identifies response tab and returns full metadata', async () => {
    const mockDrive = (google.drive as any)();
    const mockForms = (google.forms as any)();
    const mockSheets = (google.sheets as any)();

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

    const result = await createAndLinkDailyMeetingSurvey({
      templateFormId: 'template_form_111',
      surveyTitle: '2026-08-22 정기모임 참석 조사',
      callerEmail: 'admin@avalon.club',
      authClient: {} as any,
    });

    expect(result.success).toBe(true);
    expect(result.formId).toBe('new_form_789');
    expect(result.formTitle).toBe('2026-08-22 정기모임 참석 조사');
    expect(result.formResponderUrl).toBe('https://docs.google.com/forms/d/e/new_form_789/viewform');
    expect(result.spreadsheetId).toBe('new_sheet_456');
    expect(result.responseSheetId).toBe(101);
    expect(result.responseSheetTitle).toBe('설문지 응답 시트 1');
  });

  it('handles Drive copy failure gracefully', async () => {
    const mockDrive = (google.drive as any)();
    mockDrive.files.copy.mockRejectedValueOnce(new Error('Drive quota exceeded'));

    const result = await createAndLinkDailyMeetingSurvey({
      templateFormId: 'template_form_111',
      surveyTitle: '2026-08-22 정기모임 참석 조사',
      callerEmail: 'admin@avalon.club',
      authClient: {} as any,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Drive quota exceeded');
  });
});
