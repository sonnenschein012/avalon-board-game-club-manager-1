import { defineSecret } from 'firebase-functions/params';

export const googleClientIdSecret = defineSecret('GOOGLE_CLIENT_ID');
export const googleClientSecretSecret = defineSecret('GOOGLE_CLIENT_SECRET');

export function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } {
  let clientId = '';
  let clientSecret = '';

  try {
    clientId = googleClientIdSecret.value();
  } catch {
    clientId = process.env.GOOGLE_CLIENT_ID || process.env.LOCAL_GOOGLE_CLIENT_ID || '';
  }

  try {
    clientSecret = googleClientSecretSecret.value();
  } catch {
    clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.LOCAL_GOOGLE_CLIENT_SECRET || '';
  }

  return { clientId, clientSecret };
}
