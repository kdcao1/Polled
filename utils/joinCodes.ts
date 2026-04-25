import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebaseConfig';

type JoinCodeEventData = {
  joinCode?: string | null;
  identityRequirement?: string | null;
};

const normalizeIdentityRequirement = (value?: string | null) =>
  value === 'linked_account' ? 'linked_account' : 'none';

const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const reserveUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const joinCode = generateJoinCode();
    const joinCodeSnapshot = await getDoc(doc(db, 'joinCodes', joinCode));
    if (!joinCodeSnapshot.exists()) return joinCode;
  }

  throw new Error('Could not reserve a unique join code.');
};

export const ensureJoinCodeForEvent = async (eventId: string, eventData?: JoinCodeEventData | null) => {
  const joinCode = eventData?.joinCode?.trim().toUpperCase();
  const identityRequirement = normalizeIdentityRequirement(eventData?.identityRequirement);

  if (!joinCode) {
    const nextJoinCode = await reserveUniqueJoinCode();
    await updateDoc(doc(db, 'events', eventId), { joinCode: nextJoinCode });
    await setDoc(doc(db, 'joinCodes', nextJoinCode), {
      eventId,
      identityRequirement,
      createdAt: serverTimestamp(),
    });
    return nextJoinCode;
  }

  const joinCodeRef = doc(db, 'joinCodes', joinCode);
  const joinCodeSnapshot = await getDoc(joinCodeRef);

  if (joinCodeSnapshot.exists()) {
    await updateDoc(joinCodeRef, { identityRequirement });
    return joinCode;
  }

  await setDoc(joinCodeRef, {
    eventId,
    identityRequirement,
    createdAt: serverTimestamp(),
  });
  return joinCode;
};

export const restoreJoinCodeForEvent = ensureJoinCodeForEvent;
