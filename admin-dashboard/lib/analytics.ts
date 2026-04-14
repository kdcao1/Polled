import { db, auth } from './firebase-admin';
import type { auth as AdminAuth } from 'firebase-admin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAllUsers(): Promise<AdminAuth.UserRecord[]> {
  const users: AdminAuth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

function toDate(ts: string | undefined): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toYYYYMMDD(d: Date): string {
  return toYMD(d).replace(/-/g, '');
}

function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Overview KPIs ────────────────────────────────────────────────────────────

export async function fetchOverview() {
  const cutoff28 = startOfDay(28);

  const [users, eventsSnap, membersSnap, pollsSnap] = await Promise.all([
    getAllUsers(),
    db.collection('events').get(),
    db.collectionGroup('members').get(),
    db.collectionGroup('polls').get(),
  ]);

  const activeUsers = users.filter((u) => {
    const last = toDate(u.metadata.lastSignInTime);
    return last && last >= cutoff28;
  }).length;

  const newUsers = users.filter((u) => {
    const created = toDate(u.metadata.creationTime);
    return created && created >= cutoff28;
  }).length;

  return {
    activeUsers,
    newUsers,
    sessions:        membersSnap.size,   // total event joins
    screenPageViews: pollsSnap.size,     // total polls created
    eventCount:      eventsSnap.size,
  };
}

// ─── Daily Active Users (last 30 days, by lastSignInTime) ─────────────────────

export async function fetchDailyUsers() {
  const users = await getAllUsers();
  const cutoff = startOfDay(29);
  const counts: Record<string, number> = {};

  for (const u of users) {
    const last = toDate(u.metadata.lastSignInTime);
    if (last && last >= cutoff) {
      const key = toYYYYMMDD(last);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, users]) => ({ date, users }));
}

// ─── Top Events (by poll count) ───────────────────────────────────────────────

export async function fetchTopEvents() {
  const [eventsSnap, pollsSnap] = await Promise.all([
    db.collection('events').get(),
    db.collectionGroup('polls').get(),
  ]);

  const titleMap: Record<string, string> = {};
  for (const doc of eventsSnap.docs) {
    titleMap[doc.id] = doc.data().title ?? doc.id;
  }

  const pollCounts: Record<string, number> = {};
  for (const doc of pollsSnap.docs) {
    const eventId = doc.ref.parent.parent?.id ?? '';
    pollCounts[eventId] = (pollCounts[eventId] ?? 0) + 1;
  }

  return Object.entries(pollCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([id, count]) => ({ event: titleMap[id] ?? id, count }));
}

// ─── Top Events by Members ────────────────────────────────────────────────────

export async function fetchTopScreens() {
  const [eventsSnap, membersSnap, pollsSnap] = await Promise.all([
    db.collection('events').get(),
    db.collectionGroup('members').get(),
    db.collectionGroup('polls').get(),
  ]);

  const titleMap: Record<string, string> = {};
  for (const doc of eventsSnap.docs) titleMap[doc.id] = doc.data().title ?? doc.id;

  const memberCounts: Record<string, number> = {};
  for (const doc of membersSnap.docs) {
    const eventId = doc.ref.parent.parent?.id ?? '';
    memberCounts[eventId] = (memberCounts[eventId] ?? 0) + 1;
  }

  const pollCounts: Record<string, number> = {};
  for (const doc of pollsSnap.docs) {
    const eventId = doc.ref.parent.parent?.id ?? '';
    pollCounts[eventId] = (pollCounts[eventId] ?? 0) + 1;
  }

  return Object.entries(memberCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, members]) => ({
      screen: titleMap[id] ?? id,
      views:  members,
      users:  pollCounts[id] ?? 0,
    }));
}

// ─── New vs Returning Users ───────────────────────────────────────────────────

export async function fetchUserType() {
  const users = await getAllUsers();
  const cutoff = startOfDay(28);
  let newCount = 0;

  for (const u of users) {
    const created = toDate(u.metadata.creationTime);
    if (created && created >= cutoff) newCount++;
  }

  return [
    { type: 'new',       users: newCount },
    { type: 'returning', users: users.length - newCount },
  ];
}

// ─── Sign-in Provider Breakdown ───────────────────────────────────────────────

export async function fetchPlatforms() {
  const users = await getAllUsers();
  const counts: Record<string, number> = {};

  for (const u of users) {
    const provider =
      u.providerData[0]?.providerId === 'google.com' ? 'Google'
      : u.providerData[0]?.providerId === 'password'  ? 'Email'
      : u.providerData.length === 0                   ? 'Anonymous'
      : u.providerData[0]?.providerId ?? 'Other';
    counts[provider] = (counts[provider] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([platform, users]) => ({ platform, users }));
}

// ─── User Activity Over Time (1-day / 7-day / 28-day rolling) ────────────────

export async function fetchUserActivityOverTime() {
  const users = await getAllUsers();

  // Build a set of active dates per user from lastSignInTime
  const userLastSignIn: Date[] = users
    .map((u) => toDate(u.metadata.lastSignInTime))
    .filter(Boolean) as Date[];

  const result: { date: string; oneDay: number; sevenDay: number; twentyEightDay: number }[] = [];

  for (let i = 27; i >= 0; i--) {
    const day     = startOfDay(i);
    const dayEnd  = new Date(day.getTime() + 86400000 - 1);
    const day7    = startOfDay(i + 6);
    const day28   = startOfDay(i + 27);

    result.push({
      date:           toYYYYMMDD(day),
      oneDay:         userLastSignIn.filter((d) => d >= day && d <= dayEnd).length,
      sevenDay:       userLastSignIn.filter((d) => d >= day7 && d <= dayEnd).length,
      twentyEightDay: userLastSignIn.filter((d) => d >= day28 && d <= dayEnd).length,
    });
  }

  return result;
}

// ─── DAU: This week vs Last week ─────────────────────────────────────────────

export async function fetchDAUComparison() {
  const users = await getAllUsers();

  const today = startOfDay(0);
  const thisWeek: number[] = Array(7).fill(0);
  const lastWeek: number[] = Array(7).fill(0);

  for (const u of users) {
    const last = toDate(u.metadata.lastSignInTime);
    if (!last) continue;
    const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
    if (diff >= 0 && diff <= 6)  thisWeek[6 - diff]++;
    else if (diff <= 13)         lastWeek[13 - diff]++;
  }

  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return { thisWeek, lastWeek, labels };
}

// ─── Day-1 Retention (new users who signed in again the next day) ─────────────

export async function fetchDay1Retention() {
  const users = await getAllUsers();
  const today = startOfDay(0);

  const thisWeek: { label: string; rate: number }[] = [];
  const lastWeek: { label: string; rate: number }[] = [];

  for (let i = 13; i >= 0; i--) {
    const day     = startOfDay(i);
    const dayEnd  = new Date(day.getTime() + 86400000 - 1);
    const nextDay = startOfDay(i - 1);

    const newOnDay = users.filter((u) => {
      const created = toDate(u.metadata.creationTime);
      return created && created >= day && created <= dayEnd;
    });

    const retained = newOnDay.filter((u) => {
      const last = toDate(u.metadata.lastSignInTime);
      return last && last >= nextDay;
    });

    const rate = newOnDay.length > 0
      ? Math.round((retained.length / newOnDay.length) * 100)
      : 0;

    const label = toYMD(day);
    const diff  = Math.round((today.getTime() - day.getTime()) / 86400000);

    if (diff <= 6)  thisWeek.push({ label, rate });
    else            lastWeek.push({ label, rate });
  }

  return {
    thisWeek: thisWeek.reverse(),
    lastWeek: lastWeek.reverse(),
  };
}
