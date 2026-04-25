import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

function readServiceAccountJson() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const value = rawKey || credentialsPath;

  if (!value) {
    throw new Error(
      'Firebase Admin credentials are not set. Set GOOGLE_SERVICE_ACCOUNT_KEY to JSON or a file path, or set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  if (value.startsWith('{')) return value;
  return readFileSync(value, 'utf8');
}

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;
  const raw = readServiceAccountJson();
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

export function getAdminDb() {
  return admin.firestore(getAdminApp());
}

export function getAdminAuth() {
  return admin.auth(getAdminApp());
}
