# Notification Worker

This worker processes Firestore `notificationJobs` and sends Expo push notifications without requiring Firebase Cloud Functions.

## What It Does

1. Polls `notificationJobs` for queued jobs
2. Verifies the actor is the organizer of the target event
3. Reads event members
4. Reads private Expo push tokens from `users/{uid}`
5. Sends push notifications through Expo
6. Marks the job as `sent` or `failed`

## Required Environment

Set one of these on the server that runs the worker:

- `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`
- `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
- and `FIREBASE_PROJECT_ID=polled-f5b29` if your host does not auto-detect project ID

The most reliable setup on a custom VPS is:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`

Optional:

- `NOTIFICATION_WORKER_POLL_MS=5000`
- `NOTIFICATION_WORKER_BATCH_SIZE=10`

## Setup

```bash
cd server/notification-worker
npm install
npm run build
npm start
```

For local development:

```bash
cd server/notification-worker
npm install
npm run dev
```

## Docker

Build and run with Docker Compose:

```bash
cd server/notification-worker
docker compose up -d --build
```

Before you run it:

1. Open `docker-compose.yml`
2. Replace `/absolute/path/on/host/firebase-service-account.json` with the real host path to your service account JSON
3. Keep `GOOGLE_APPLICATION_CREDENTIALS` as `/run/secrets/firebase-service-account.json`

The container reads the mounted JSON file from that in-container path.

## Deployment Notes

- Run this on a server you control.
- It does not need to live on `polled.app`, but it must have network access to Firestore and Expo Push.
- Keep the service account private.
