import { getAdminAuth, getAdminDb } from './firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  provider: string;
  createdAt: string;
  lastSignInAt: string;
};

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  updatedAt: string;
};

export type StaleEventCandidate = {
  id: string;
  title: string;
  status: string;
  joinCode: string;
  lastActivityAt: string;
  ageDays: number;
};

export type AdminEvent = {
  id: string;
  title: string;
  status: string;
  joinCode: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
};

export type StaleUserCandidate = {
  uid: string;
  email: string;
  displayName: string;
  provider: string;
  createdAt: string;
  lastSignInAt: string;
  ageDays: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  total?: number;
};

function hasFirebaseAdminKey() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  );
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function toIso(value: unknown) {
  return toDate(value)?.toISOString() ?? '';
}

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function canUseFirebaseAdmin() {
  return hasFirebaseAdminKey();
}

export async function fetchAdminUsers(page = 1, pageSize = 20): Promise<PaginatedResult<AdminUser>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  if (!hasFirebaseAdminKey()) {
    return { items: [], page: safePage, pageSize: safePageSize, hasNext: false, hasPrevious: false };
  }

  const auth = getAdminAuth();
  let pageToken: string | undefined;
  let result = await auth.listUsers(safePageSize);

  for (let currentPage = 1; currentPage < safePage && result.pageToken; currentPage += 1) {
    pageToken = result.pageToken;
    result = await auth.listUsers(safePageSize, pageToken);
  }

  return {
    items: result.users.map((user) => ({
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      disabled: user.disabled,
      provider: user.providerData[0]?.providerId ?? (user.providerData.length ? 'other' : 'anonymous'),
      createdAt: user.metadata.creationTime ?? '',
      lastSignInAt: user.metadata.lastSignInTime ?? '',
    })),
    page: safePage,
    pageSize: safePageSize,
    hasNext: Boolean(result.pageToken),
    hasPrevious: safePage > 1,
  };
}

export async function fetchMaintenanceState(): Promise<MaintenanceState> {
  if (!hasFirebaseAdminKey()) {
    return { enabled: false, message: '', updatedAt: '' };
  }

  const snapshot = await getAdminDb().collection('appConfig').doc('global').get();
  const data = snapshot.data() ?? {};

  return {
    enabled: data.maintenanceMode === true,
    message: typeof data.maintenanceMessage === 'string' ? data.maintenanceMessage : '',
    updatedAt: toIso(data.updatedAt),
  };
}

function eventFromDoc(doc: QueryDocumentSnapshot): AdminEvent {
  const data = doc.data();
  return {
    id: doc.id,
    title: typeof data.title === 'string' ? data.title : 'Untitled event',
    status: typeof data.status === 'string' ? data.status : '',
    joinCode: typeof data.joinCode === 'string' ? data.joinCode : '',
    organizerId: typeof data.organizerId === 'string' ? data.organizerId : '',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function fetchAdminEvents(page = 1, pageSize = 20): Promise<PaginatedResult<AdminEvent>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  if (!hasFirebaseAdminKey()) {
    return { items: [], page: safePage, pageSize: safePageSize, hasNext: false, hasPrevious: false };
  }

  const offset = (safePage - 1) * safePageSize;
  const snapshot = await getAdminDb()
    .collection('events')
    .orderBy('createdAt', 'desc')
    .offset(offset)
    .limit(safePageSize + 1)
    .get();
  const docs = snapshot.docs.slice(0, safePageSize);

  return {
    items: docs.map(eventFromDoc),
    page: safePage,
    pageSize: safePageSize,
    hasNext: snapshot.docs.length > safePageSize,
    hasPrevious: safePage > 1,
  };
}

export async function fetchAllStaleUserCandidates(days = 90): Promise<StaleUserCandidate[]> {
  if (!hasFirebaseAdminKey()) return [];

  const cutoffMs = Date.now() - days * 86400000;
  const auth = getAdminAuth();
  const users: StaleUserCandidate[] = [];
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      const lastSignIn = toDate(user.metadata.lastSignInTime);
      const created = toDate(user.metadata.creationTime);
      const lastActivity = lastSignIn ?? created;
      if (!lastActivity || lastActivity.getTime() > cutoffMs) continue;

      users.push({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        provider: user.providerData[0]?.providerId ?? (user.providerData.length ? 'other' : 'anonymous'),
        createdAt: user.metadata.creationTime ?? '',
        lastSignInAt: user.metadata.lastSignInTime ?? '',
        ageDays: daysSince(lastActivity),
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  return users.sort((a, b) => b.ageDays - a.ageDays);
}

export async function fetchStaleUserCandidates(
  days = 90,
  page = 1,
  pageSize = 20
): Promise<PaginatedResult<StaleUserCandidate>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const candidates = await fetchAllStaleUserCandidates(days);
  const start = (safePage - 1) * safePageSize;
  const items = candidates.slice(start, start + safePageSize);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total: candidates.length,
    hasNext: start + safePageSize < candidates.length,
    hasPrevious: safePage > 1,
  };
}

export async function fetchAllStaleEventCandidates(days = 30): Promise<StaleEventCandidate[]> {
  if (!hasFirebaseAdminKey()) return [];

  const db = getAdminDb();
  const cutoffMs = Date.now() - days * 86400000;
  const events = await db.collection('events').limit(500).get();
  const candidates: StaleEventCandidate[] = [];

  for (const eventDoc of events.docs) {
    const eventData = eventDoc.data();
    const activityDates = [
      toDate(eventData.createdAt),
      toDate(eventData.updatedAt),
      toDate(eventData.endedAt),
      toDate(eventData.scheduledAt),
    ].filter((date): date is Date => Boolean(date));

    const [polls, members] = await Promise.all([
      eventDoc.ref.collection('polls').limit(50).get(),
      eventDoc.ref.collection('members').limit(50).get(),
    ]);

    for (const poll of polls.docs) {
      const pollData = poll.data();
      activityDates.push(
        ...[
          toDate(pollData.createdAt),
          toDate(pollData.updatedAt),
          toDate(pollData.finalizedAt),
        ].filter((date): date is Date => Boolean(date))
      );
    }

    for (const member of members.docs) {
      const memberData = member.data();
      const joinedAt = toDate(memberData.joinedAt);
      if (joinedAt) activityDates.push(joinedAt);
    }

    const lastActivity = activityDates.sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastActivity || lastActivity.getTime() > cutoffMs) continue;

    candidates.push({
      id: eventDoc.id,
      title: typeof eventData.title === 'string' ? eventData.title : 'Untitled event',
      status: typeof eventData.status === 'string' ? eventData.status : '',
      joinCode: typeof eventData.joinCode === 'string' ? eventData.joinCode : '',
      lastActivityAt: lastActivity.toISOString(),
      ageDays: daysSince(lastActivity),
    });
  }

  return candidates.sort((a, b) => b.ageDays - a.ageDays);
}

export async function fetchStaleEventCandidates(
  days = 30,
  page = 1,
  pageSize = 20
): Promise<PaginatedResult<StaleEventCandidate>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const candidates = await fetchAllStaleEventCandidates(days);
  const start = (safePage - 1) * safePageSize;
  const items = candidates.slice(start, start + safePageSize);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total: candidates.length,
    hasNext: start + safePageSize < candidates.length,
    hasPrevious: safePage > 1,
  };
}
