import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported, Analytics, logEvent } from 'firebase/analytics';
import nativeAnalytics from '@react-native-firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBdk_5ryzPLg5-mZ3BDP4WJHoFkXOyJoHo",
  authDomain: "polled-f5b29.firebaseapp.com",
  projectId: "polled-f5b29",
  storageBucket: "polled-f5b29.firebasestorage.app",
  messagingSenderId: "1059076773398",
  appId: "1:1059076773398:web:df7199c30fb3080b9d0737",
  measurementId: "G-Q9K2YQQ0LM"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

const persistence = Platform.OS === 'web' 
  ? browserLocalPersistence 
  : getReactNativePersistence(ReactNativeAsyncStorage);

export const auth = initializeAuth(app, { persistence });

export let analytics: Analytics | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export const logAppEvent = async (eventName: string, params?: Record<string, any>) => {
  try {
    if (Platform.OS === 'web') {
      // Use the Web SDK
      if (analytics) {
        logEvent(analytics, eventName, params);
        console.log(`📊 [Web Analytics Sent]: ${eventName}`, params);
      }
    } else {
      // Use the Native iOS/Android SDK
      await nativeAnalytics().logEvent(eventName, params);
    }
  } catch (error) {
    console.error("Analytics Error:", error);
  }
};