import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginSilently } from '../config/firebaseConfig';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User already has an anonymous session saved on their device
        setUser(currentUser);
        setIsLoading(false);
      } else {
        // First time opening the app, generate a silent UID
        const newUser = await loginSilently();
        setUser(newUser);
        setIsLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return { user, isLoading };
};