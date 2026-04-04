# Firebase Backend Plan

This app is ready for a safer notification flow, but the push fanout should move off the client before you deploy strict Firestore rules.

## Goal

Keep `users/{uid}` private so Expo push tokens are never readable by other clients.

## Hosting Options

You have two workable backend shapes:

- Firebase Cloud Functions
- A standalone Node worker that runs on your own server

This repo now includes the standalone worker in `server/notification-worker`, which is useful if you are staying off the Blaze plan.

## Recommended Collections

- `users/{uid}`
  - Private user state
  - Example fields: `joinedEvents`, `expoPushToken`, `displayName`
- `profiles/{uid}`
  - Public profile data used by participant lists
  - Example fields: `displayName`
- `events/{eventId}`
  - Event metadata
- `events/{eventId}/members/{uid}`
  - Membership list for access control and headcount
- `events/{eventId}/polls/{pollId}`
  - Poll and role docs
- `notificationJobs/{jobId}`
  - Queue of notification work created by the app

## Notification Job Shape

Use one document per request:

```json
{
  "eventId": "abc123",
  "actorUid": "uid_1",
  "type": "poll_nudge",
  "title": "Don't forget to vote!",
  "body": "The poll is waiting for your response.",
  "createdAt": "serverTimestamp()",
  "status": "queued"
}
```

Suggested `type` values:

- `poll_created`
- `role_created`
- `poll_nudge`
- `role_nudge`

## Minimal Backend Worker

Create one backend worker that reacts to `notificationJobs/{jobId}`.

It should:

1. Load the job doc.
2. Verify `actorUid` is allowed to trigger that notification for `eventId`.
3. Read `events/{eventId}/members/*` to get recipient UIDs.
4. Read private `users/{uid}.expoPushToken` for those recipients.
5. Send notifications through Expo Push API.
6. Mark the job as `sent` or `failed`.
7. Optionally clear invalid Expo tokens from user docs.

## Suggested Trigger Rules

- Only organizers should be allowed to send:
  - `poll_created`
  - `role_created`
  - `poll_nudge`
  - `role_nudge`
- Skip the actor’s own token when fanout runs.
- Add simple rate limits per event to avoid spam.

## Client Migration Plan

Replace the current direct Expo Push calls with:

1. `addDoc(collection(db, 'notificationJobs'), job)`
2. Show a local success toast
3. Let the backend worker handle token lookup and delivery

## Why This Matters

With strict Firestore rules, clients should not be able to read:

- other users’ `expoPushToken`
- other users’ full private user docs

This backend shape keeps notifications working without reopening those reads.
