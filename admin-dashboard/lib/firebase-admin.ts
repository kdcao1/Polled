import { readFileSync, statSync } from 'node:fs';
import admin from 'firebase-admin';

function readServiceAccountJson() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const source = rawKey ? 'GOOGLE_SERVICE_ACCOUNT_KEY' : 'GOOGLE_APPLICATION_CREDENTIALS';
  const value = rawKey || credentialsPath;

  if (!value) {
    throw new Error(
      'Firebase Admin credentials are not set. Set GOOGLE_SERVICE_ACCOUNT_KEY to JSON or a file path, or set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  if (value.startsWith('{')) return value;

  const stats = statSync(value);
  if (stats.isDirectory()) {
    throw new Error(`${source} points to a directory. Set it to the service account JSON file path, for example /home/kdcao/Documents/credentials.json.`);
  }

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
