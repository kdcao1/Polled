import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebaseConfig';

const MAX_BATCH_OPERATIONS = 400;

type BatchOperation = (batch: ReturnType<typeof writeBatch>) => void;

async function commitOperationsInChunks(operations: BatchOperation[]) {
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);

    operations
      .slice(index, index + MAX_BATCH_OPERATIONS)
      .forEach((operation) => operation(batch));

    await batch.commit();
  }
}

export async function deleteEventCompletely(eventId: string) {
  const eventSnapshot = await getDoc(doc(db, 'events', eventId));
  const pollsSnapshot = await getDocs(collection(db, 'events', eventId, 'polls'));
  const membersSnapshot = await getDocs(collection(db, 'events', eventId, 'members'));

  const operations: BatchOperation[] = [];

  pollsSnapshot.forEach((pollDoc) => {
    operations.push((batch) => {
      batch.delete(pollDoc.ref);
    });
  });

  membersSnapshot.forEach((memberDoc) => {
    operations.push((batch) => {
      batch.delete(memberDoc.ref);
    });
  });

  await commitOperationsInChunks(operations);

  const joinCode = eventSnapshot.data()?.joinCode;
  if (typeof joinCode === 'string' && joinCode.length > 0) {
    await deleteDoc(doc(db, 'joinCodes', joinCode));
  }

  if (auth.currentUser?.uid) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      joinedEvents: arrayRemove(eventId),
    }).catch(() => undefined);
  }

  await deleteDoc(doc(db, 'events', eventId));
}
