import { collection, doc, getDocs, setDoc, query, where, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useRouter } from 'expo-router';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

type CreateEventInput = {
  title: string;
  description?: string;
};

export const useEvents = () => {
  const router = useRouter();

  const createNewEvent = async ({ title, description = '' }: CreateEventInput) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    let isUnique = false;
    let newJoinCode = '';

    while (!isUnique) {
      newJoinCode = generateCode();
      const q = query(collection(db, 'events'), where('joinCode', '==', newJoinCode));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
      }
    }

    try {
      const eventRef = doc(collection(db, 'events'));
      const secureEventId = eventRef.id;

      await setDoc(eventRef, {
        title: title.trim(),
        description: description.trim(),
        joinCode: newJoinCode,
        organizerId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'draft',
        time: '',
        location: '',
        summary: {
          totalPolls: 0,
          totalVotes: 0,
          topPolls: [],
        },
      });

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          joinedEvents: arrayUnion(secureEventId),
        },
        { merge: true }
      );

      router.push(`/event/${secureEventId}`);
    } catch (error) {
      console.error('Error creating event: ', error);
    }
  };

  return { createNewEvent };
};
