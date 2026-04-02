import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBdk_5ryzPLg5-mZ3BDP4WJHoFkXOyJoHo",
  authDomain: "polled-f5b29.firebaseapp.com",
  projectId: "polled-f5b29",
  storageBucket: "polled-f5b29.firebasestorage.app",
  messagingSenderId: "1059076773398",
  appId: "1:1059076773398:web:df7199c30fb3080b9d0737",
  measurementId: "G-Q9K2YQQ0LM"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

const persistence = Platform.OS === 'web' 
  ? browserLocalPersistence 
  : getReactNativePersistence(ReactNativeAsyncStorage);

export const auth = initializeAuth(app, { persistence });
