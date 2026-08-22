import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateAuthUrl,
  getGoogleOAuth2Client,
  revokeToken,
} from '../googleOAuth';

describe('functions googleOAuth module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates correct OAuth client instance with specified credentials', () => {
    const client = getGoogleOAuth2Client({
      clientId: 'mock-client-id.apps.googleusercontent.com',
      clientSecret: 'mock-client-secret',
      redirectUri: 'http://localhost:5173/oauth2callback',
    });
    expect(client).toBeDefined();
  });

  it('generates authorization consent URL with minimal drive.file & userinfo scopes and CSRF state', () => {
    const client = getGoogleOAuth2Client({
      clientId: 'mock-client-id.apps.googleusercontent.com',
      clientSecret: 'mock-client-secret',
      redirectUri: 'http://localhost:5173/oauth2callback',
    });

    const csrfState = 'random_csrf_token_hex_12345';
    const url = generateAuthUrl(client, csrfState);

    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(`state=${csrfState}`);
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/drive.file'));
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/userinfo.email'));
    // Ensure broad forms.body or spreadsheets are not requested by default in Phase 1
    expect(url).not.toContain(encodeURIComponent('https://www.googleapis.com/auth/forms.body'));
    expect(url).not.toContain(encodeURIComponent('https://www.googleapis.com/auth/spreadsheets'));
  });

  it('supports incremental authorization by adding extra scopes when explicitly requested', () => {
    const client = getGoogleOAuth2Client({
      clientId: 'mock-client-id.apps.googleusercontent.com',
      clientSecret: 'mock-client-secret',
      redirectUri: 'http://localhost:5173/oauth2callback',
    });

    const url = generateAuthUrl(client, 'state_123', ['https://www.googleapis.com/auth/forms.body']);
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/forms.body'));
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/drive.file'));
  });

  it('handles token revocation gracefully even if google server returns error', async () => {
    const mockClient = {
      revokeToken: vi.fn().mockRejectedValueOnce(new Error('Revocation token expired or network error')),
    } as any;

    const success = await revokeToken(mockClient, 'some_token');
    expect(success).toBe(false);
  });

  it('returns true when token revocation succeeds on google server', async () => {
    const mockClient = {
      revokeToken: vi.fn().mockResolvedValueOnce({}),
    } as any;

    const success = await revokeToken(mockClient, 'valid_token');
    expect(success).toBe(true);
  });
});
