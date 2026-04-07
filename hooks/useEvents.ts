import { collection, doc, getDoc, setDoc, serverTimestamp, arrayUnion, writeBatch } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useRouter } from 'expo-router';
import { trackEvent } from '@/utils/analytics';

// Increased to 8 characters for better security
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useEvents = () => {
  const router = useRouter();

  const createNewEvent = async (title: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    let isUnique = false;
    let newJoinCode = '';

    // 1. Generate code and check Firestore to ensure no other event has it
    while (!isUnique) {
      newJoinCode = generateCode();
      const joinCodeDoc = await getDoc(doc(db, 'joinCodes', newJoinCode));
      if (!joinCodeDoc.exists()) {
        isUnique = true;
      }
    }

    try {
      // 2. Let Firestore generate a massive, secure Document ID
      const eventRef = doc(collection(db, 'events')); 
      const secureEventId = eventRef.id;
      const userRef = doc(db, 'users', currentUser.uid);
      const memberRef = doc(db, 'events', secureEventId, 'members', currentUser.uid);
      const joinCodeRef = doc(db, 'joinCodes', newJoinCode);
      const batch = writeBatch(db);

      // 3. Save the event with the joinCode attached as a field
      batch.set(eventRef, {
        title: title,
        joinCode: newJoinCode, 
        organizerId: currentUser.uid,
        identityRequirement: 'none',
        createdAt: serverTimestamp(),
        status: 'voting',
        time: '',
        location: '',
        scheduledAt: null,
        endedAt: null,
      });

      // 4. Save the SECURE ID to the user's dashboard list, not the short code
      batch.set(userRef, {
        joinedEvents: arrayUnion(secureEventId)
      }, { merge: true });

      batch.set(memberRef, {
        uid: currentUser.uid,
        joinedAt: serverTimestamp(),
        role: 'organizer',
      });

      batch.set(joinCodeRef, {
        eventId: secureEventId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      trackEvent('event_created', {
        event_id: secureEventId,
        title_length: title.trim().length,
      });

      // 5. Route to the secure URL using REPLACE so the form is cleared from history
      router.replace(`/event/${secureEventId}`);

    } catch (error) {
      console.error("Error creating event: ", error);
    }
  };

  return { createNewEvent };
};
