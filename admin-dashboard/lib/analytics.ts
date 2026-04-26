import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { getAdminAuth, getAdminDb } from './firebase-admin';
import type { auth as AdminAuth } from 'firebase-admin';

type Overview = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  screenPageViews: number;
  eventCount: number;
};

type DailyUsersPoint = { date: string; users: number };
type TopEventPoint = { event: string; count: number };
type TopScreenPoint = { screen: string; views: number; users: number };
type UserTypePoint = { type: string; users: number };
type PlatformPoint = { platform: string; users: number };
type ActivityPoint = { date: string; oneDay: number; sevenDay: number; twentyEightDay: number };
type DauComparison = { labels: string[]; thisWeek: number[]; lastWeek: number[] };
type RetentionPoint = { label: string; rate: number };
type RetentionComparison = { thisWeek: RetentionPoint[]; lastWeek: RetentionPoint[] };
export type ActionAnalyticsPoint = { action: string; count: number; users: number };
export type TimeAnalyticsPoint = { metric: string; samples: number; averageSeconds: number; medianSeconds: number };
export type TrackedEventInventoryPoint = {
  name: string;
  label: string;
  category: string;
  observedCount: number;
  lastSeenAt: string | null;
};
export type RecentAnalyticsEvent = {
  name: string;
  label: string;
  kind: string;
  uid: string;
  platform: string;
  ingestedAt: string;
  params: string;
};
export type AnalyticsIngestStatus = {
  sqliteEnabled: boolean;
  totalEvents: number;
  eventsLast24h: number;
  usersLast24h: number;
  lastEventAt: string | null;
};

export const ANALYTICS_RANGES = [
  { key: '28d', label: '28 days' },
  { key: 'today', label: 'Today' },
  { key: '3h', label: '3 hours' },
  { key: '1h', label: '1 hour' },
] as const;

export type AnalyticsRangeKey = typeof ANALYTICS_RANGES[number]['key'];

type AnalyticsRow = {
  uid: string | null;
  auth_provider: string | null;
  kind: string;
  name: string;
  params_json: string;
  client_created_at: string | null;
  ingested_at: string;
  platform: string | null;
};

type DatabaseStatement = {
  all: (...params: unknown[]) => unknown[];
};

type DatabaseInstance = {
  prepare: (sql: string) => DatabaseStatement;
  close: () => void;
};

type DatabaseSyncConstructor = new (databasePath: string) => DatabaseInstance;

const TRACKED_EVENT_INVENTORY = [
  ['screen_view', 'Navigation'],
  ['landing_cta_clicked', 'Acquisition'],
  ['dashboard_cta_clicked', 'Navigation'],
  ['settings_opened', 'Navigation'],
  ['event_opened', 'Navigation'],
  ['event_action_menu_opened', 'Navigation'],
  ['event_access_redirected_to_join', 'Navigation'],
  ['onboarding_completed', 'Account'],
  ['login_attempt', 'Account'],
  ['login_success', 'Account'],
  ['login_failed', 'Account'],
  ['account_linked', 'Account'],
  ['account_link_cancelled', 'Account'],
  ['profile_updated', 'Account'],
  ['logout', 'Account'],
  ['donate_opened', 'Account'],
  ['event_join_attempt', 'Join Flow'],
  ['event_joined', 'Join Flow'],
  ['event_join_failed', 'Join Flow'],
  ['event_created', 'Event Lifecycle'],
  ['event_updated', 'Event Lifecycle'],
  ['event_edit_started', 'Event Lifecycle'],
  ['event_removed_from_dashboard', 'Event Lifecycle'],
  ['event_ended_manual', 'Event Lifecycle'],
  ['event_restarted_manual', 'Event Lifecycle'],
  ['event_exact_time_set', 'Event Lifecycle'],
  ['event_shared', 'Sharing'],
  ['event_code_copied', 'Sharing'],
  ['qr_modal_opened', 'Sharing'],
  ['calendar_modal_opened', 'Sharing'],
  ['calendar_add_started', 'Sharing'],
  ['participants_modal_opened', 'Event Participation'],
  ['roles_tab_opened', 'Event Participation'],
  ['item_create_started', 'Polls and Roles'],
  ['feature_clicked', 'Polls and Roles'],
  ['poll_created', 'Polls and Roles'],
  ['poll_updated', 'Polls and Roles'],
  ['poll_deleted', 'Polls and Roles'],
  ['poll_loaded', 'Polls and Roles'],
  ['poll_missed', 'Polls and Roles'],
  ['poll_voted', 'Polls and Roles'],
  ['poll_response_submitted', 'Polls and Roles'],
  ['poll_choice_added_by_invitee', 'Polls and Roles'],
  ['poll_edit_started', 'Polls and Roles'],
  ['poll_rerun_started', 'Polls and Roles'],
  ['poll_ended_early', 'Polls and Roles'],
  ['role_created', 'Polls and Roles'],
  ['role_updated', 'Polls and Roles'],
  ['role_deleted', 'Polls and Roles'],
  ['role_claimed', 'Polls and Roles'],
  ['role_unclaimed', 'Polls and Roles'],
  ['poll_nudged', 'Notifications'],
  ['role_nudged', 'Notifications'],
  ['availability_date_stage_completed', 'Availability'],
  ['availability_time_stage_completed', 'Availability'],
  ['availability_time_stage_tied', 'Availability'],
  ['availability_time_tie_resolved', 'Availability'],
  ['quick_poll_result_applied', 'Decision Timing'],
  ['time_to_creation_measured', 'Decision Timing'],
  ['time_to_vote_measured', 'Decision Timing'],
  ['time_to_decision_measured', 'Decision Timing'],
  ['results_dwell_time', 'Decision Timing'],
  ['post_vote_refresh', 'Decision Timing'],
  ['abandonment_node', 'Journey Health'],
] as const;

function hasFirebaseAdminKey() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  );
}

function getSqlitePath() {
  const configured = process.env.ANALYTICS_SQLITE_PATH?.trim();
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  return resolve(process.cwd(), '..', 'server', 'notification-worker', 'data', 'analytics.sqlite');
}

function openSqliteDatabase(): DatabaseInstance | null {
  const databasePath = getSqlitePath();
  if (!existsSync(databasePath)) return null;

  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: DatabaseSyncConstructor };
  return new DatabaseSync(databasePath);
}

function getLocalRows(): AnalyticsRow[] {
  const database = openSqliteDatabase();
  if (!database) return [];

  try {
    return database.prepare(`
      SELECT uid, auth_provider, kind, name, params_json, client_created_at, ingested_at, platform
      FROM analytics_events
      ORDER BY ingested_at DESC
    `).all() as AnalyticsRow[];
  } finally {
    database.close();
  }
}

function parseParams(row: AnalyticsRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(row.params_json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function rowDate(row: AnalyticsRow): Date | null {
  return toDate(row.client_created_at || row.ingested_at);
}

function rowEventId(row: AnalyticsRow) {
  const params = parseParams(row);
  const eventId = params.event_id;
  return typeof eventId === 'string' && eventId ? eventId : null;
}

function formatEventName(name: string) {
  return name
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function numericParam(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function uniqueUids(rows: AnalyticsRow[]) {
  return new Set(rows.map((row) => row.uid).filter((uid): uid is string => Boolean(uid)));
}

export function normalizeAnalyticsRange(value: unknown): AnalyticsRangeKey {
  return ANALYTICS_RANGES.some((range) => range.key === value) ? value as AnalyticsRangeKey : '28d';
}

export function analyticsRangeLabel(range: AnalyticsRangeKey) {
  return ANALYTICS_RANGES.find((option) => option.key === range)?.label ?? '28 days';
}

async function getAllUsers(): Promise<AdminAuth.UserRecord[]> {
  const auth = getAdminAuth();
  const users: AdminAuth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

function toDate(ts: string | undefined | null): Date | null {
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

function analyticsRangeStart(range: AnalyticsRangeKey): Date {
  const now = new Date();
  if (range === '1h') return new Date(now.getTime() - 60 * 60 * 1000);
  if (range === '3h') return new Date(now.getTime() - 3 * 60 * 60 * 1000);
  if (range === 'today') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today;
  }
  return startOfDay(28);
}

function dateRangeKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const d = startOfDay(days - 1 - index);
    return toYYYYMMDD(d);
  });
}

function localRowsSince(daysAgo: number) {
  const cutoff = startOfDay(daysAgo);
  return getLocalRows().filter((row) => {
    const date = rowDate(row);
    return date && date >= cutoff;
  });
}

function localRowsForRange(range: AnalyticsRangeKey) {
  const cutoff = analyticsRangeStart(range);
  return getLocalRows().filter((row) => {
    const date = rowDate(row);
    return date && date >= cutoff;
  });
}

async function fetchFirebaseOverview(): Promise<Overview> {
  const db = getAdminDb();
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
    sessions: membersSnap.size,
    screenPageViews: pollsSnap.size,
    eventCount: eventsSnap.size,
  };
}

function fetchLocalOverview(range: AnalyticsRangeKey = '28d'): Overview {
  const rows = localRowsForRange(range);
  const allRows = getLocalRows();
  const firstSeenByUid = new Map<string, Date>();

  for (const row of allRows) {
    if (!row.uid) continue;
    const date = rowDate(row);
    if (!date) continue;
    const existing = firstSeenByUid.get(row.uid);
    if (!existing || date < existing) firstSeenByUid.set(row.uid, date);
  }

  const cutoff = analyticsRangeStart(range);

  return {
    activeUsers: uniqueUids(rows).size,
    newUsers: Array.from(firstSeenByUid.values()).filter((date) => date >= cutoff).length,
    sessions: rows.filter((row) => row.name === 'event_joined').length,
    screenPageViews: rows.filter((row) => row.kind === 'screen_view').length,
    eventCount: new Set(rows.map(rowEventId).filter(Boolean)).size,
  };
}

async function fetchFirebaseDailyUsers(): Promise<DailyUsersPoint[]> {
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

function fetchLocalDailyUsers(): DailyUsersPoint[] {
  const rows = localRowsSince(29);
  const usersByDay = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.uid) continue;
    const date = rowDate(row);
    if (!date) continue;
    const key = toYYYYMMDD(date);
    usersByDay.set(key, usersByDay.get(key) ?? new Set());
    usersByDay.get(key)!.add(row.uid);
  }

  return dateRangeKeys(30).map((date) => ({ date, users: usersByDay.get(date)?.size ?? 0 }));
}

async function fetchFirebaseTopEvents(): Promise<TopEventPoint[]> {
  const db = getAdminDb();
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

function fetchLocalTopEvents(range: AnalyticsRangeKey = '28d'): TopEventPoint[] {
  const counts: Record<string, number> = {};

  for (const row of localRowsForRange(range)) {
    const eventId = rowEventId(row);
    if (!eventId) continue;
    counts[eventId] = (counts[eventId] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([event, count]) => ({ event, count }));
}

async function fetchFirebaseTopScreens(): Promise<TopScreenPoint[]> {
  const db = getAdminDb();
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
      views: members,
      users: pollCounts[id] ?? 0,
    }));
}

function fetchLocalTopScreens(range: AnalyticsRangeKey = '28d'): TopScreenPoint[] {
  const counts: Record<string, { views: number; users: Set<string> }> = {};

  for (const row of localRowsForRange(range)) {
    if (row.kind !== 'screen_view') continue;
    const params = parseParams(row);
    const rawScreen = params.firebase_screen;
    const screen = typeof rawScreen === 'string' && rawScreen ? rawScreen.split('?')[0] : row.name;
    counts[screen] = counts[screen] ?? { views: 0, users: new Set<string>() };
    counts[screen].views += 1;
    if (row.uid) counts[screen].users.add(row.uid);
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 10)
    .map(([screen, stats]) => ({ screen, views: stats.views, users: stats.users.size }));
}

async function fetchFirebaseUserType(): Promise<UserTypePoint[]> {
  const users = await getAllUsers();
  const cutoff = startOfDay(28);
  let newCount = 0;

  for (const u of users) {
    const created = toDate(u.metadata.creationTime);
    if (created && created >= cutoff) newCount++;
  }

  return [
    { type: 'new', users: newCount },
    { type: 'returning', users: users.length - newCount },
  ];
}

function fetchLocalUserType(range: AnalyticsRangeKey = '28d'): UserTypePoint[] {
  const rows = getLocalRows();
  const firstSeenByUid = new Map<string, Date>();
  const seenInRange = uniqueUids(localRowsForRange(range));

  for (const row of rows) {
    if (!row.uid) continue;
    const date = rowDate(row);
    if (!date) continue;
    const existing = firstSeenByUid.get(row.uid);
    if (!existing || date < existing) firstSeenByUid.set(row.uid, date);
  }

  const cutoff = analyticsRangeStart(range);
  const newCount = Array.from(firstSeenByUid.entries()).filter(
    ([uid, date]) => seenInRange.has(uid) && date >= cutoff
  ).length;

  return [
    { type: 'new', users: newCount },
    { type: 'returning', users: Math.max(0, seenInRange.size - newCount) },
  ];
}

async function fetchFirebasePlatforms(): Promise<PlatformPoint[]> {
  const users = await getAllUsers();
  const counts: Record<string, number> = {};

  for (const u of users) {
    const provider =
      u.providerData[0]?.providerId === 'google.com' ? 'Google'
      : u.providerData[0]?.providerId === 'password' ? 'Email'
      : u.providerData.length === 0 ? 'Anonymous'
      : u.providerData[0]?.providerId ?? 'Other';
    counts[provider] = (counts[provider] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([platform, users]) => ({ platform, users }));
}

function fetchLocalPlatforms(range: AnalyticsRangeKey = '28d'): PlatformPoint[] {
  const counts: Record<string, Set<string>> = {};

  for (const row of localRowsForRange(range)) {
    const platform = row.platform || 'unknown';
    counts[platform] = counts[platform] ?? new Set<string>();
    if (row.uid) counts[platform].add(row.uid);
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b.size - a.size)
    .map(([platform, users]) => ({ platform, users: users.size }));
}

async function fetchFirebaseUserActivityOverTime(): Promise<ActivityPoint[]> {
  const users = await getAllUsers();
  const userLastSignIn: Date[] = users
    .map((u) => toDate(u.metadata.lastSignInTime))
    .filter(Boolean) as Date[];

  const result: ActivityPoint[] = [];

  for (let i = 27; i >= 0; i--) {
    const day = startOfDay(i);
    const dayEnd = new Date(day.getTime() + 86400000 - 1);
    const day7 = startOfDay(i + 6);
    const day28 = startOfDay(i + 27);

    result.push({
      date: toYYYYMMDD(day),
      oneDay: userLastSignIn.filter((d) => d >= day && d <= dayEnd).length,
      sevenDay: userLastSignIn.filter((d) => d >= day7 && d <= dayEnd).length,
      twentyEightDay: userLastSignIn.filter((d) => d >= day28 && d <= dayEnd).length,
    });
  }

  return result;
}

function fetchLocalUserActivityOverTime(): ActivityPoint[] {
  const rows = getLocalRows().filter((row) => row.uid && rowDate(row));
  const byUid = new Map<string, Date[]>();

  for (const row of rows) {
    const date = rowDate(row);
    if (!row.uid || !date) continue;
    byUid.set(row.uid, byUid.get(row.uid) ?? []);
    byUid.get(row.uid)!.push(date);
  }

  const result: ActivityPoint[] = [];

  for (let i = 27; i >= 0; i--) {
    const day = startOfDay(i);
    const dayEnd = new Date(day.getTime() + 86400000 - 1);
    const day7 = startOfDay(i + 6);
    const day28 = startOfDay(i + 27);
    const users = Array.from(byUid.values());

    result.push({
      date: toYYYYMMDD(day),
      oneDay: users.filter((dates) => dates.some((d) => d >= day && d <= dayEnd)).length,
      sevenDay: users.filter((dates) => dates.some((d) => d >= day7 && d <= dayEnd)).length,
      twentyEightDay: users.filter((dates) => dates.some((d) => d >= day28 && d <= dayEnd)).length,
    });
  }

  return result;
}

async function fetchFirebaseDAUComparison(): Promise<DauComparison> {
  const users = await getAllUsers();
  const today = startOfDay(0);
  const thisWeek: number[] = Array(7).fill(0);
  const lastWeek: number[] = Array(7).fill(0);

  for (const u of users) {
    const last = toDate(u.metadata.lastSignInTime);
    if (!last) continue;
    const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
    if (diff >= 0 && diff <= 6) thisWeek[6 - diff]++;
    else if (diff <= 13) lastWeek[13 - diff]++;
  }

  return { thisWeek, lastWeek, labels: weekLabels(today) };
}

function fetchLocalDAUComparison(): DauComparison {
  const rows = getLocalRows().filter((row) => row.uid && rowDate(row));
  const today = startOfDay(0);
  const thisWeek: number[] = Array(7).fill(0);
  const lastWeek: number[] = Array(7).fill(0);
  const usersByOffset = new Map<number, Set<string>>();

  for (const row of rows) {
    const date = rowDate(row);
    if (!date || !row.uid) continue;
    const diff = Math.floor((today.getTime() - startOfDayFromDate(date).getTime()) / 86400000);
    if (diff < 0 || diff > 13) continue;
    usersByOffset.set(diff, usersByOffset.get(diff) ?? new Set());
    usersByOffset.get(diff)!.add(row.uid);
  }

  for (let diff = 0; diff <= 13; diff++) {
    const count = usersByOffset.get(diff)?.size ?? 0;
    if (diff <= 6) thisWeek[6 - diff] = count;
    else lastWeek[13 - diff] = count;
  }

  return { thisWeek, lastWeek, labels: weekLabels(today) };
}

function weekLabels(today: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
}

function startOfDayFromDate(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function fetchFirebaseDay1Retention(): Promise<RetentionComparison> {
  const users = await getAllUsers();
  const today = startOfDay(0);
  const thisWeek: RetentionPoint[] = [];
  const lastWeek: RetentionPoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const day = startOfDay(i);
    const dayEnd = new Date(day.getTime() + 86400000 - 1);
    const nextDay = startOfDay(i - 1);

    const newOnDay = users.filter((u) => {
      const created = toDate(u.metadata.creationTime);
      return created && created >= day && created <= dayEnd;
    });

    const retained = newOnDay.filter((u) => {
      const last = toDate(u.metadata.lastSignInTime);
      return last && last >= nextDay;
    });

    const rate = newOnDay.length > 0 ? Math.round((retained.length / newOnDay.length) * 100) : 0;
    const label = toYMD(day);
    const diff = Math.round((today.getTime() - day.getTime()) / 86400000);

    if (diff <= 6) thisWeek.push({ label, rate });
    else lastWeek.push({ label, rate });
  }

  return { thisWeek: thisWeek.reverse(), lastWeek: lastWeek.reverse() };
}

function fetchLocalDay1Retention(): RetentionComparison {
  const emptyWeek = Array.from({ length: 7 }, (_, index) => {
    const day = startOfDay(6 - index);
    return { label: toYMD(day), rate: 0 };
  });

  const previousWeek = Array.from({ length: 7 }, (_, index) => {
    const day = startOfDay(13 - index);
    return { label: toYMD(day), rate: 0 };
  });

  return { thisWeek: emptyWeek, lastWeek: previousWeek };
}

export async function fetchOverview(range: AnalyticsRangeKey = '28d') {
  return hasFirebaseAdminKey() && range === '28d' ? fetchFirebaseOverview() : fetchLocalOverview(range);
}

export async function fetchDailyUsers() {
  return hasFirebaseAdminKey() ? fetchFirebaseDailyUsers() : fetchLocalDailyUsers();
}

export async function fetchTopEvents(range: AnalyticsRangeKey = '28d') {
  return hasFirebaseAdminKey() && range === '28d' ? fetchFirebaseTopEvents() : fetchLocalTopEvents(range);
}

export async function fetchTopScreens(range: AnalyticsRangeKey = '28d') {
  return hasFirebaseAdminKey() && range === '28d' ? fetchFirebaseTopScreens() : fetchLocalTopScreens(range);
}

export async function fetchUserType(range: AnalyticsRangeKey = '28d') {
  return hasFirebaseAdminKey() && range === '28d' ? fetchFirebaseUserType() : fetchLocalUserType(range);
}

export async function fetchPlatforms(range: AnalyticsRangeKey = '28d') {
  return hasFirebaseAdminKey() && range === '28d' ? fetchFirebasePlatforms() : fetchLocalPlatforms(range);
}

export async function fetchUserActivityOverTime() {
  return hasFirebaseAdminKey() ? fetchFirebaseUserActivityOverTime() : fetchLocalUserActivityOverTime();
}

export async function fetchDAUComparison() {
  return hasFirebaseAdminKey() ? fetchFirebaseDAUComparison() : fetchLocalDAUComparison();
}

export async function fetchDay1Retention() {
  return hasFirebaseAdminKey() ? fetchFirebaseDay1Retention() : fetchLocalDay1Retention();
}

export async function fetchActionAnalytics(range: AnalyticsRangeKey = '28d'): Promise<ActionAnalyticsPoint[]> {
  const ignored = new Set(['screen_view']);
  const counts = new Map<string, { count: number; users: Set<string> }>();

  for (const row of localRowsForRange(range)) {
    if (row.kind !== 'event' || ignored.has(row.name)) continue;
    const entry = counts.get(row.name) ?? { count: 0, users: new Set<string>() };
    entry.count += 1;
    if (row.uid) entry.users.add(row.uid);
    counts.set(row.name, entry);
  }

  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 18)
    .map(([action, stats]) => ({
      action: formatEventName(action),
      count: stats.count,
      users: stats.users.size,
    }));
}

export async function fetchTimeAnalytics(range: AnalyticsRangeKey = '28d'): Promise<TimeAnalyticsPoint[]> {
  const samples = new Map<string, number[]>();

  for (const row of localRowsForRange(range)) {
    const params = parseParams(row);
    const seconds = numericParam(params, 'duration_seconds');
    if (seconds === null) continue;

    const label = formatEventName(row.name);
    samples.set(label, samples.get(label) ?? []);
    samples.get(label)!.push(seconds);
  }

  return Array.from(samples.entries())
    .map(([metric, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const midpoint = Math.floor(sorted.length / 2);
      const medianSeconds =
        sorted.length % 2 === 0
          ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
          : sorted[midpoint];
      const averageSeconds = values.reduce((sum, value) => sum + value, 0) / values.length;

      return {
        metric,
        samples: values.length,
        averageSeconds: Number(averageSeconds.toFixed(1)),
        medianSeconds: Number(medianSeconds.toFixed(1)),
      };
    })
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 12);
}

export async function fetchAnalyticsIngestStatus(): Promise<AnalyticsIngestStatus> {
  const rows = getLocalRows();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRows = rows.filter((row) => {
    const date = rowDate(row);
    return date && date >= cutoff24h;
  });

  return {
    sqliteEnabled: existsSync(getSqlitePath()),
    totalEvents: rows.length,
    eventsLast24h: recentRows.length,
    usersLast24h: uniqueUids(recentRows).size,
    lastEventAt: rows[0]?.ingested_at ?? null,
  };
}

export async function fetchTrackedEventInventory(range: AnalyticsRangeKey = '28d'): Promise<TrackedEventInventoryPoint[]> {
  const rows = localRowsForRange(range);
  const observed = new Map<string, { count: number; lastSeenAt: string | null }>();

  for (const row of rows) {
    const current = observed.get(row.name) ?? { count: 0, lastSeenAt: null };
    current.count += 1;
    if (!current.lastSeenAt) current.lastSeenAt = row.ingested_at;
    observed.set(row.name, current);
  }

  const inventory = new Map<string, string>();
  for (const [name, category] of TRACKED_EVENT_INVENTORY) inventory.set(name, category);
  for (const name of Array.from(observed.keys())) {
    if (!inventory.has(name)) inventory.set(name, 'Observed Only');
  }

  return Array.from(inventory.entries())
    .map(([name, category]) => ({
      name,
      label: formatEventName(name),
      category,
      observedCount: observed.get(name)?.count ?? 0,
      lastSeenAt: observed.get(name)?.lastSeenAt ?? null,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

export async function fetchRecentAnalyticsEvents(
  limit = 60,
  range: AnalyticsRangeKey = '28d'
): Promise<RecentAnalyticsEvent[]> {
  return localRowsForRange(range)
    .slice(0, limit)
    .map((row) => ({
      name: row.name,
      label: formatEventName(row.name),
      kind: row.kind,
      uid: row.uid ? row.uid.slice(0, 8) : 'unknown',
      platform: row.platform || 'unknown',
      ingestedAt: row.ingested_at,
      params: JSON.stringify(parseParams(row)),
    }));
}

export function getAnalyticsSourceLabel() {
  return hasFirebaseAdminKey() ? 'Firebase Auth + Firestore' : 'Local SQLite analytics';
}
