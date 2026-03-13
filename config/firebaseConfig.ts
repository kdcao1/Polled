import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBdk_5ryzPLg5-mZ3BDP4WJHoFkXOyJoHo",
  authDomain: "polled-f5b29.firebaseapp.com",
  projectId: "polled-f5b29",
  storageBucket: "polled-f5b29.firebasestorage.app",
  messagingSenderId: "1059076773398",
  appId: "1:1059076773398:web:df7199c30fb3080b9d0737",
  measurementId: "G-Q9K2YQQ0LM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore for use in your app
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper function to trigger the silent login
export const loginSilently = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in:", error);
    return null;
  }
};