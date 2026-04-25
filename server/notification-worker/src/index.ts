import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { accessSync, chmodSync, constants, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import {
  AppOptions,
  ServiceAccount,
  applicationDefault,
  cert,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  CollectionReference,
  DocumentReference,
  FieldValue,
  Firestore,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';

const localEnvPath = resolve(process.cwd(), '.env');
if (typeof process.loadEnvFile === 'function' && existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || '';
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || '';
const GOOGLE_APPLICATION_CREDENTIALS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || '';

const adminOptions = buildFirebaseAdminOptions();
const adminApp = initializeApp(adminOptions);

const db = getFirestore(adminApp);
const expo = new Expo();

const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_POLL_MS ?? 5000);
const MAX_JOBS_PER_POLL = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE ?? 10);
const ANALYTICS_HTTP_PORT = Number(process.env.ANALYTICS_HTTP_PORT ?? 8787);

type NotificationJobType =
  | 'poll_created'
  | 'role_created'
  | 'poll_nudge'
  | 'role_nudge';

type NotificationJob = {
  actorUid?: string;
  body?: string;
  createdAt?: Timestamp;
  deliveredCount?: number;
  eventId?: string;
  failedAt?: Timestamp;
  failedCount?: number;
  failureReason?: string;
  processingStartedAt?: Timestamp;
  recipientCount?: number;
  sentAt?: Timestamp;
  skippedCount?: number;
  status?: 'queued' | 'processing' | 'sent' | 'failed';
  title?: string;
  type?: NotificationJobType;
};

type EventMember = {
  uid?: string;
};

type UserPrivateData = {
  expoPushToken?: string;
};

type AnalyticsEvent = {
  authProvider?: string;
  clientCreatedAt?: string | null;
  ingestedAt?: FieldValue;
  kind: 'event' | 'screen_view';
  name: string;
  params: Record<string, string | number>;
  platform?: string | null;
  uid?: string | null;
};

type AnalyticsIngestPayload = {
  clientCreatedAt?: unknown;
  kind?: unknown;
  name?: unknown;
  params?: unknown;
  platform?: unknown;
};

const ALLOWED_JOB_TYPES = new Set<NotificationJobType>([
  'poll_created',
  'role_created',
  'poll_nudge',
  'role_nudge',
]);

let isPolling = false;

const ANALYTICS_SQLITE_PATH = resolve(
  process.env.ANALYTICS_SQLITE_PATH?.trim() || './data/analytics.sqlite'
);
const analyticsDb = initializeAnalyticsDatabase(ANALYTICS_SQLITE_PATH);
const insertAnalyticsEvent = analyticsDb.prepare(`
  INSERT INTO analytics_events (
    uid,
    auth_provider,
    kind,
    name,
    params_json,
    client_created_at,
    ingested_at,
    platform
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

function buildFirebaseAdminOptions(): AppOptions {
  const options: AppOptions = {};

  if (FIREBASE_PROJECT_ID) {
    options.projectId = FIREBASE_PROJECT_ID;
  }

  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount & {
        project_id?: string;
      };

      options.credential = cert(serviceAccount);
      options.projectId ||= serviceAccount.project_id;
      return options;
    } catch (error) {
      throw new Error(
        `Invalid FIREBASE_SERVICE_ACCOUNT_JSON. ${
          error instanceof Error ? error.message : 'Could not parse service account JSON.'
        }`
      );
    }
  }

  if (GOOGLE_APPLICATION_CREDENTIALS_PATH) {
    const stats = statSync(GOOGLE_APPLICATION_CREDENTIALS_PATH);
    if (stats.isDirectory()) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS points to a directory. Set it to the Firebase service account JSON file path, for example /home/kdcao/Documents/credentials.json. Current value: ${GOOGLE_APPLICATION_CREDENTIALS_PATH}`
      );
    }

    try {
      const serviceAccount = JSON.parse(
        readFileSync(GOOGLE_APPLICATION_CREDENTIALS_PATH, 'utf8')
      ) as ServiceAccount & {
        project_id?: string;
      };

      options.credential = cert(serviceAccount);
      options.projectId ||= serviceAccount.project_id;
    } catch (error) {
      throw new Error(
        `Invalid GOOGLE_APPLICATION_CREDENTIALS file at ${GOOGLE_APPLICATION_CREDENTIALS_PATH}. ${
          error instanceof Error ? error.message : 'Could not parse service account JSON.'
        }`
      );
    }

    return options;
  }

  if (options.projectId) {
    options.credential = applicationDefault();
    return options;
  }

  throw new Error(
    'Missing Firebase Admin configuration. Set FIREBASE_SERVICE_ACCOUNT_JSON, or set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_PROJECT_ID.'
  );
}

async function main() {
  console.log(
    `[worker] starting notification worker for project=${adminOptions.projectId ?? 'unknown'} poll=${POLL_INTERVAL_MS}ms batch=${MAX_JOBS_PER_POLL}`
  );

  startHttpServer();
  await pollOnce();

  setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

async function pollOnce() {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const jobsSnapshot = await queuedJobsCollection(db)
      .where('status', '==', 'queued')
      .limit(MAX_JOBS_PER_POLL)
      .get();

    for (const jobDoc of jobsSnapshot.docs) {
      await tryClaimAndProcessJob(jobDoc.ref);
    }
  } catch (error) {
    console.error('[worker] poll failed', error);
  } finally {
    isPolling = false;
  }
}

function queuedJobsCollection(firestore: Firestore) {
  return firestore.collection('notificationJobs') as CollectionReference<NotificationJob>;
}

function initializeAnalyticsDatabase(databasePath: string) {
  const databaseDir = dirname(databasePath);
  mkdirSync(databaseDir, { recursive: true });

  try {
    accessSync(databaseDir, constants.W_OK);
  } catch {
    chmodSync(databaseDir, 0o775);
  }

  if (existsSync(databasePath)) {
    try {
      accessSync(databasePath, constants.W_OK);
    } catch {
      chmodSync(databasePath, 0o664);
    }
  }

  const database = new DatabaseSync(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      auth_provider TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      params_json TEXT NOT NULL,
      client_created_at TEXT,
      ingested_at TEXT NOT NULL,
      platform TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_ingested_at
      ON analytics_events (ingested_at DESC);

    CREATE INDEX IF NOT EXISTS idx_analytics_events_name
      ON analytics_events (name);
  `);

  try {
    database.exec('PRAGMA user_version = user_version;');
  } catch (error) {
    throw new Error(
      `Analytics SQLite database is not writable at ${databasePath}. Check the host mount permissions for ${databaseDir}. ${
        error instanceof Error ? error.message : 'Unknown SQLite write error.'
      }`
    );
  }

  return database;
}

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin?.trim();
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

function normalizeAnalyticsParams(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entryValue]) => {
      if (typeof entryValue === 'string' || typeof entryValue === 'number') {
        return [[key, entryValue]];
      }

      if (typeof entryValue === 'boolean') {
        return [[key, entryValue ? 'true' : 'false']];
      }

      return [];
    })
  ) as Record<string, string | number>;
}

function normalizeAnalyticsPayload(rawBody: unknown): AnalyticsEvent | null {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return null;
  }

  const payload = rawBody as AnalyticsIngestPayload;
  const kind = payload.kind === 'event' || payload.kind === 'screen_view' ? payload.kind : null;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';

  if (!kind || !name) {
    return null;
  }

  return {
    kind,
    name,
    params: normalizeAnalyticsParams(payload.params),
    clientCreatedAt:
      typeof payload.clientCreatedAt === 'string' ? payload.clientCreatedAt : null,
    platform: typeof payload.platform === 'string' ? payload.platform : null,
  };
}

async function verifyAnalyticsAuthToken(req: IncomingMessage) {
  const rawAuthorization = req.headers.authorization?.trim() ?? '';
  if (!rawAuthorization.startsWith('Bearer ')) {
    throw new Error('missing-bearer-token');
  }

  const token = rawAuthorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('missing-bearer-token');
  }

  return getAuth(adminApp).verifyIdToken(token);
}

async function handleAnalyticsIngest(req: IncomingMessage, res: ServerResponse) {
  try {
    const decodedToken = await verifyAnalyticsAuthToken(req);
    const requestBody = await readJsonBody(req);
    const event = normalizeAnalyticsPayload(requestBody);

    if (!event) {
      sendJson(res, 400, { error: 'invalid-analytics-payload' });
      return;
    }

    insertAnalyticsEvent.run(
      decodedToken.uid,
      typeof decodedToken.firebase?.sign_in_provider === 'string'
        ? decodedToken.firebase.sign_in_provider
        : 'unknown',
      event.kind,
      event.name,
      JSON.stringify(event.params),
      event.clientCreatedAt ?? null,
      new Date().toISOString(),
      event.platform ?? null
    );

    sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    const statusCode =
      message === 'missing-bearer-token' || message.includes('verifyIdToken')
        ? 401
        : message === 'invalid-analytics-payload'
          ? 400
          : 500;

    if (statusCode === 500) {
      console.error('[worker] analytics ingest failed', error);
    }

    sendJson(res, statusCode, { error: message });
  }
}

function startHttpServer() {
  const server = createServer((req, res) => {
    setCorsHeaders(req, res);

    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === 'GET' && url === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'polled-notification-worker',
        projectId: adminOptions.projectId ?? null,
      });
      return;
    }

    if (method === 'POST' && url === '/analytics') {
      void handleAnalyticsIngest(req, res);
      return;
    }

    sendJson(res, 404, { error: 'not-found' });
  });

  server.listen(ANALYTICS_HTTP_PORT, () => {
    console.log(
      `[worker] analytics ingest listening on :${ANALYTICS_HTTP_PORT} sqlite=${ANALYTICS_SQLITE_PATH}`
    );
  });
}

async function tryClaimAndProcessJob(jobRef: DocumentReference<NotificationJob>) {
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return false;

    const job = snapshot.data();
    if (!job || job.status !== 'queued') {
      return false;
    }

    transaction.set(
      jobRef,
      {
        status: 'processing',
        processingStartedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  });

  if (!claimed) {
    return;
  }

  await processJob(jobRef);
}

async function processJob(jobRef: DocumentReference<NotificationJob>) {
  const jobSnapshot = await jobRef.get();
  const job = jobSnapshot.data();

  if (!job) {
    return;
  }

  if (
    !job.actorUid ||
    !job.eventId ||
    !job.title ||
    !job.body ||
    !job.type ||
    !ALLOWED_JOB_TYPES.has(job.type)
  ) {
    await markJobFailed(jobRef, 'invalid-job-payload');
    return;
  }

  try {
    const eventRef = db.doc(`events/${job.eventId}`);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      await markJobFailed(jobRef, 'event-not-found');
      return;
    }

    const eventData = eventSnap.data();
    if (!eventData || eventData.organizerId !== job.actorUid) {
      await markJobFailed(jobRef, 'actor-not-organizer');
      return;
    }

    const membersSnap = await eventRef.collection('members').get();
    const recipientUids = membersSnap.docs
      .map((memberDoc) => ((memberDoc.data() as EventMember).uid ?? memberDoc.id).trim())
      .filter((uid) => uid.length > 0 && uid !== job.actorUid);

    if (recipientUids.length === 0) {
      await markJobSent(jobRef, {
        recipientCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
      });
      return;
    }

    const userSnaps = await Promise.all(
      recipientUids.map((uid) => db.doc(`users/${uid}`).get())
    );

    const messages: ExpoPushMessage[] = [];
    let skippedCount = 0;

    for (const userSnap of userSnaps) {
      const token = (userSnap.data() as UserPrivateData | undefined)?.expoPushToken?.trim();

      if (!token) {
        skippedCount += 1;
        continue;
      }

      if (!Expo.isExpoPushToken(token)) {
        console.warn('[worker] skipping invalid Expo token', { uid: userSnap.id });
        skippedCount += 1;
        continue;
      }

      messages.push({
        to: token,
        sound: 'default',
        title: job.title,
        body: job.body,
        data: {
          eventId: job.eventId,
          type: job.type,
        },
      });
    }

    if (messages.length === 0) {
      await markJobSent(jobRef, {
        recipientCount: recipientUids.length,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount,
      });
      return;
    }

    const chunks = expo.chunkPushNotifications(messages);
    let deliveredCount = 0;
    let failedCount = 0;

    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          deliveredCount += 1;
          return;
        }

        failedCount += 1;
        console.error('[worker] expo ticket error', {
          details: ticket.details,
          message: ticket.message,
          token: chunk[index]?.to,
        });
      });
    }

    if (failedCount > 0) {
      await jobRef.set(
        {
          status: 'failed',
          sentAt: FieldValue.serverTimestamp(),
          recipientCount: recipientUids.length,
          deliveredCount,
          failedCount,
          skippedCount,
          failureReason: 'partial-delivery-failure',
        },
        { merge: true }
      );
      return;
    }

    await markJobSent(jobRef, {
      recipientCount: recipientUids.length,
      deliveredCount,
      failedCount,
      skippedCount,
    });
  } catch (error) {
    console.error('[worker] job processing failed', {
      jobId: jobRef.id,
      error,
    });
    await markJobFailed(jobRef, error instanceof Error ? error.message : 'unknown-error');
  }
}

async function markJobSent(
  jobRef: DocumentReference<NotificationJob>,
  counts: {
    deliveredCount: number;
    failedCount: number;
    recipientCount: number;
    skippedCount: number;
  }
) {
  await jobRef.set(
    {
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      ...counts,
    },
    { merge: true }
  );
}

async function markJobFailed(jobRef: DocumentReference<NotificationJob>, reason: string) {
  await jobRef.set(
    {
      status: 'failed',
      failedAt: FieldValue.serverTimestamp(),
      failureReason: reason,
    },
    { merge: true }
  );
}

void main();
