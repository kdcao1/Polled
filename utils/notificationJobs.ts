import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebaseConfig';

export type NotificationJobType =
  | 'poll_created'
  | 'role_created'
  | 'poll_nudge'
  | 'role_nudge';

type NotificationJobInput = {
  eventId: string;
  type: NotificationJobType;
  title: string;
  body: string;
};

export async function enqueueNotificationJob({
  eventId,
  type,
  title,
  body,
}: NotificationJobInput) {
  const actorUid = auth.currentUser?.uid;
  if (!actorUid) return;

  await addDoc(collection(db, 'notificationJobs'), {
    eventId,
    actorUid,
    type,
    title,
    body,
    status: 'queued',
    createdAt: serverTimestamp(),
  });
}
