import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from './firebase-admin';

export function requireFirebaseAdminCredentials() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim() && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    throw new Error('Firebase Admin credentials are required for admin actions.');
  }
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function updateUserFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const uid = formString(formData, 'uid');
  const displayName = formString(formData, 'displayName');
  const disabled = formData.get('disabled') === 'on';
  if (!uid) throw new Error('Missing user id.');

  await getAdminAuth().updateUser(uid, {
    displayName: displayName || undefined,
    disabled,
  });

  await getAdminDb().collection('users').doc(uid).set(
    {
      displayName,
      disabled,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteUserFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const uid = formString(formData, 'uid');
  if (!uid) throw new Error('Missing user id.');

  await getAdminAuth().deleteUser(uid);
  await getAdminDb().collection('users').doc(uid).delete().catch(() => undefined);
}

export async function setMaintenanceFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const enabledValue = formString(formData, 'enabled');
  const enabled = enabledValue === 'on' || enabledValue === 'true';
  const message = formString(formData, 'message');

  await getAdminDb().collection('appConfig').doc('global').set(
    {
      maintenanceMode: enabled,
      maintenanceMessage: message || 'Polled is temporarily down for maintenance.',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return enabled;
}

export async function deleteEventCompletely(eventId: string) {
  const db = getAdminDb();
  const eventRef = db.collection('events').doc(eventId);
  const eventSnapshot = await eventRef.get();
  if (!eventSnapshot.exists) return;

  const [pollsSnapshot, membersSnapshot] = await Promise.all([
    eventRef.collection('polls').get(),
    eventRef.collection('members').get(),
  ]);

  const memberIds = membersSnapshot.docs.map((doc) => doc.id);
  const eventData = eventSnapshot.data() ?? {};
  const joinCode = typeof eventData.joinCode === 'string' ? eventData.joinCode : '';

  const refs = [
    ...pollsSnapshot.docs.map((doc) => doc.ref),
    ...membersSnapshot.docs.map((doc) => doc.ref),
  ];

  for (let index = 0; index < refs.length; index += 400) {
    const batch = db.batch();
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  if (joinCode) {
    await db.collection('joinCodes').doc(joinCode).delete().catch(() => undefined);
  }

  for (const uid of memberIds) {
    await db.collection('users').doc(uid).update({
      joinedEvents: FieldValue.arrayRemove(eventId),
    }).catch(() => undefined);
  }

  await eventRef.delete();
}

export async function deleteEventFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const eventId = formString(formData, 'eventId');
  if (!eventId) throw new Error('Missing event id.');

  await deleteEventCompletely(eventId);
}

export async function flushStaleEventsFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const rawDays = Number.parseInt(formString(formData, 'days'), 10);
  const days = Number.isFinite(rawDays) ? Math.max(1, rawDays) : 30;
  const confirm = formString(formData, 'confirm');

  if (confirm !== 'DELETE') {
    throw new Error('Type DELETE to confirm stale event deletion.');
  }

  const { fetchAllStaleEventCandidates } = await import('./admin-data');
  const candidates = await fetchAllStaleEventCandidates(days);
  for (const candidate of candidates) {
    await deleteEventCompletely(candidate.id);
  }

  return { days, count: candidates.length };
}

export async function flushStaleUsersFromForm(formData: FormData) {
  requireFirebaseAdminCredentials();
  const rawDays = Number.parseInt(formString(formData, 'days'), 10);
  const days = Number.isFinite(rawDays) ? Math.max(1, rawDays) : 90;
  const confirm = formString(formData, 'confirm');

  if (confirm !== 'DELETE') {
    throw new Error('Type DELETE to confirm stale user deletion.');
  }

  const { fetchAllStaleUserCandidates } = await import('./admin-data');
  const candidates = await fetchAllStaleUserCandidates(days);
  const auth = getAdminAuth();
  const db = getAdminDb();

  for (const candidate of candidates) {
    await auth.deleteUser(candidate.uid).catch(() => undefined);
    await db.collection('users').doc(candidate.uid).delete().catch(() => undefined);
    await db.collection('profiles').doc(candidate.uid).delete().catch(() => undefined);
  }

  return { days, count: candidates.length };
}
