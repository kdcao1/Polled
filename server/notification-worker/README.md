# Notification Worker

This worker processes Firestore `notificationJobs`, exposes a small authenticated analytics ingest endpoint, and sends Expo push notifications without requiring Firebase Cloud Functions.

## What It Does

1. Polls `notificationJobs` for queued jobs
2. Verifies the actor is the organizer of the target event
3. Reads event members
4. Reads private Expo push tokens from `users/{uid}`
5. Sends push notifications through Expo
6. Marks the job as `sent` or `failed`
7. Accepts authenticated `POST /analytics` requests and stores analytics events in a local SQLite database

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
- `ANALYTICS_HTTP_PORT=8787`
- `ANALYTICS_SQLITE_PATH=./data/analytics.sqlite`

## Analytics Ingest

The worker also exposes:

- `GET /health`
- `POST /analytics`

`POST /analytics` expects:

- `Authorization: Bearer <Firebase ID token>`
- JSON body with:
  - `kind`: `event` or `screen_view`
  - `name`: analytics event name
  - `params`: flat analytics params object
  - `clientCreatedAt`
  - `platform`

The mobile/web app should point `EXPO_PUBLIC_ANALYTICS_INGEST_URL` at this endpoint, for example:

```bash
EXPO_PUBLIC_ANALYTICS_INGEST_URL=https://your-worker-host/analytics
```

Analytics rows are stored in a SQLite file at `ANALYTICS_SQLITE_PATH`.
Default schema:

- table: `analytics_events`
- columns:
  - `id`
  - `uid`
  - `auth_provider`
  - `kind`
  - `name`
  - `params_json`
  - `client_created_at`
  - `ingested_at`
  - `platform`

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
4. The compose file also mounts `./data` so the SQLite analytics file persists across restarts

The container reads the mounted JSON file from that in-container path.

## Deployment Notes

- Run this on a server you control.
- It does not need to live on `polled.app`, but it must have network access to Firestore and Expo Push.
- Keep the service account private.
- Keep the analytics endpoint private behind normal hosting controls if possible. It already requires a valid Firebase ID token.
- If you run multiple worker replicas, each replica will have its own local SQLite file unless you deliberately share storage. For a single VPS/container, the mounted `./data` volume is the simplest setup.
