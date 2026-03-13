import { doc, getDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useRouter } from 'expo-router';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useEvents = () => {
  const router = useRouter();

  const createNewEvent = async (title: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("User not authenticated.");
      return;
    }

    let isUnique = false;
    let inviteCode = '';

    // 1. Generate unique code
    while (!isUnique) {
      inviteCode = generateCode();
      const docRef = doc(db, 'events', inviteCode);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        isUnique = true;
      }
    }

    try {
      // 2. Create the event document
      const eventRef = doc(db, 'events', inviteCode);
      await setDoc(eventRef, {
        title: title,
        organizerId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'voting'
      });

      // 3. Add this event to the user's personal document in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        joinedEvents: arrayUnion(inviteCode)
      }, { merge: true }); // merge: true ensures we don't overwrite their displayName if they have one

      // 4. Route to the new event
      router.push(`/event/${inviteCode}`);

    } catch (error) {
      console.error("Error creating event: ", error);
    }
  };

  return { createNewEvent };
};