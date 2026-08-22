"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleClientSecretSecret = exports.googleClientIdSecret = void 0;
exports.getGoogleOAuthCredentials = getGoogleOAuthCredentials;
const params_1 = require("firebase-functions/params");
exports.googleClientIdSecret = (0, params_1.defineSecret)('GOOGLE_CLIENT_ID');
exports.googleClientSecretSecret = (0, params_1.defineSecret)('GOOGLE_CLIENT_SECRET');
function getGoogleOAuthCredentials() {
    let clientId = '';
    let clientSecret = '';
    try {
        clientId = exports.googleClientIdSecret.value();
    }
    catch {
        clientId = process.env.GOOGLE_CLIENT_ID || process.env.LOCAL_GOOGLE_CLIENT_ID || '';
    }
    try {
        clientSecret = exports.googleClientSecretSecret.value();
    }
    catch {
        clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.LOCAL_GOOGLE_CLIENT_SECRET || '';
    }
    return { clientId, clientSecret };
}
//# sourceMappingURL=secrets.js.map