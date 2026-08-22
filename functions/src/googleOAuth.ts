import { google } from 'googleapis';
import { getGoogleOAuthCredentials } from './secrets';

export type OAuth2ClientInstance = InstanceType<typeof google.auth.OAuth2>;

/**
 * Phase 1 Minimal OAuth Scopes (Strict Least-Privilege):
 * - openid & userinfo.email: Identify connected Google Workspace account email
 * - drive.file: Per-file access to files created by Avalon or selected via Google Picker.
 *   Official Google API documentation allows Sheets API (read/write) and Drive API (copy/meta)
 *   under drive.file without requiring broad full-drive or broad spreadsheets scopes.
 *
 * Any advanced scopes (e.g. forms.body or Apps Script scopes) will be added strictly via
 * incremental authorization in Phase 5 after empirical technical verification.
 */
export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export function getGoogleOAuth2Client(config?: GoogleOAuthConfig): OAuth2ClientInstance {
  const creds = getGoogleOAuthCredentials();
  const clientId = config?.clientId || creds.clientId;
  const clientSecret = config?.clientSecret || creds.clientSecret;
  const redirectUri = config?.redirectUri || process.env.GOOGLE_REDIRECT_URI || 'postmessage';

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates an OAuth 2.0 consent URL for offline access (refresh token) with CSRF state
 * and incremental authorization support.
 */
export function generateAuthUrl(
  oauth2Client: OAuth2ClientInstance,
  state: string,
  extraScopes: string[] = []
): string {
  const scopes = Array.from(new Set([...GOOGLE_WORKSPACE_SCOPES, ...extraScopes]));

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}

/**
 * Exchanges the authorization code for tokens (access_token, refresh_token).
 */
export async function exchangeCodeForTokens(
  oauth2Client: OAuth2ClientInstance,
  code: string
): Promise<{ tokens: any; email: string | null }> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    email = userInfo.data.email || null;
  } catch (err) {
    console.warn('Failed to fetch user email during code exchange:', err);
  }

  return { tokens, email };
}

/**
 * Refreshes an access token using a stored refresh token.
 */
export async function refreshAccessToken(
  oauth2Client: OAuth2ClientInstance,
  refreshToken: string
): Promise<any> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const response = await oauth2Client.refreshAccessToken();
  return response.credentials;
}

/**
 * Revokes Google credentials on disconnect or account switch.
 */
export async function revokeToken(oauth2Client: OAuth2ClientInstance, token: string): Promise<boolean> {
  try {
    await oauth2Client.revokeToken(token);
    return true;
  } catch (err) {
    console.warn('Error during Google token revocation (continuing cleanup):', err);
    return false;
  }
}
