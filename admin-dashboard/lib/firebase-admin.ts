import admin from 'firebase-admin';

function initApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set in .env.local');
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const app = initApp();
export const db   = admin.firestore(app);
export const auth = admin.auth(app);
