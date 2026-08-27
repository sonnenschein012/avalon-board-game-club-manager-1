/*
 * Resets only the fixed local Design Lab emulator. The seed script performs
 * its own host/project checks before deleting any collections.
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-avalon-manager';
process.env.GOOGLE_CLOUD_PROJECT = 'demo-avalon-manager';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-avalon-manager' });

await import('./seed-demo.mjs');
