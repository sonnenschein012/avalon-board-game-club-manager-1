"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const googleOAuth_1 = require("../googleOAuth");
(0, vitest_1.describe)('functions googleOAuth module', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('generates correct OAuth client instance with specified credentials', () => {
        const client = (0, googleOAuth_1.getGoogleOAuth2Client)({
            clientId: 'mock-client-id.apps.googleusercontent.com',
            clientSecret: 'mock-client-secret',
            redirectUri: 'http://localhost:5173/oauth2callback',
        });
        (0, vitest_1.expect)(client).toBeDefined();
    });
    (0, vitest_1.it)('generates authorization consent URL with minimal drive.file & userinfo scopes and CSRF state', () => {
        const client = (0, googleOAuth_1.getGoogleOAuth2Client)({
            clientId: 'mock-client-id.apps.googleusercontent.com',
            clientSecret: 'mock-client-secret',
            redirectUri: 'http://localhost:5173/oauth2callback',
        });
        const csrfState = 'random_csrf_token_hex_12345';
        const url = (0, googleOAuth_1.generateAuthUrl)(client, csrfState);
        (0, vitest_1.expect)(url).toContain('access_type=offline');
        (0, vitest_1.expect)(url).toContain('prompt=consent');
        (0, vitest_1.expect)(url).toContain(`state=${csrfState}`);
        (0, vitest_1.expect)(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/drive.file'));
        (0, vitest_1.expect)(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/userinfo.email'));
        // Ensure broad forms.body or spreadsheets are not requested by default in Phase 1
        (0, vitest_1.expect)(url).not.toContain(encodeURIComponent('https://www.googleapis.com/auth/forms.body'));
        (0, vitest_1.expect)(url).not.toContain(encodeURIComponent('https://www.googleapis.com/auth/spreadsheets'));
    });
    (0, vitest_1.it)('supports incremental authorization by adding extra scopes when explicitly requested', () => {
        const client = (0, googleOAuth_1.getGoogleOAuth2Client)({
            clientId: 'mock-client-id.apps.googleusercontent.com',
            clientSecret: 'mock-client-secret',
            redirectUri: 'http://localhost:5173/oauth2callback',
        });
        const url = (0, googleOAuth_1.generateAuthUrl)(client, 'state_123', ['https://www.googleapis.com/auth/forms.body']);
        (0, vitest_1.expect)(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/forms.body'));
        (0, vitest_1.expect)(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/drive.file'));
    });
    (0, vitest_1.it)('handles token revocation gracefully even if google server returns error', async () => {
        const mockClient = {
            revokeToken: vitest_1.vi.fn().mockRejectedValueOnce(new Error('Revocation token expired or network error')),
        };
        const success = await (0, googleOAuth_1.revokeToken)(mockClient, 'some_token');
        (0, vitest_1.expect)(success).toBe(false);
    });
    (0, vitest_1.it)('returns true when token revocation succeeds on google server', async () => {
        const mockClient = {
            revokeToken: vitest_1.vi.fn().mockResolvedValueOnce({}),
        };
        const success = await (0, googleOAuth_1.revokeToken)(mockClient, 'valid_token');
        (0, vitest_1.expect)(success).toBe(true);
    });
});
//# sourceMappingURL=googleOAuth.test.js.map