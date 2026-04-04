import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import {
  AppOptions,
  ServiceAccount,
  applicationDefault,
  cert,
  initializeApp,
} from 'firebase-admin/app';
import {
  CollectionReference,
  DocumentReference,
  FieldValue,
  Firestore,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';

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

const ALLOWED_JOB_TYPES = new Set<NotificationJobType>([
  'poll_created',
  'role_created',
  'poll_nudge',
  'role_nudge',
]);

let isPolling = false;

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
    options.credential = applicationDefault();
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
