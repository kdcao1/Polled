import { collection, doc, getDocs, setDoc, query, where, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useRouter } from 'expo-router';

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

    // 1. Generate code and query Firestore to ensure no other event has it
    while (!isUnique) {
      newJoinCode = generateCode();
      const q = query(collection(db, 'events'), where('joinCode', '==', newJoinCode));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
      }
    }

    try {
      // 2. Let Firestore generate a massive, secure Document ID
      const eventRef = doc(collection(db, 'events')); 
      const secureEventId = eventRef.id;

      // 3. Save the event with the joinCode attached as a field
      await setDoc(eventRef, {
        title: title,
        joinCode: newJoinCode, 
        organizerId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'voting'
      });

      // 4. Save the SECURE ID to the user's dashboard list, not the short code
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        joinedEvents: arrayUnion(secureEventId)
      }, { merge: true });

      // 5. Route to the secure URL
      router.push(`/event/${secureEventId}`);

    } catch (error) {
      console.error("Error creating event: ", error);
    }
  };

  return { createNewEvent };
};