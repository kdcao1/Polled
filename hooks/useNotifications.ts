import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Keep foreground notifications out of the header area so in-app controls stay tappable.
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

export const useNotifications = (userId?: string | null) => {
  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (Platform.OS === 'web') return; // Web doesn't use Expo Push Tokens
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device.');
        return;
      }

      if (!userId) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#3b82f6',
          });
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        if (!projectId) {
          console.warn('Missing EAS project ID; skipping Expo push token registration.');
          return;
        }

        // 1. Grab the Expo Push Token
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        // 2. Save it to the user's Firestore profile
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          expoPushToken: token
        }, { merge: true });
        
      } catch (error) {
        console.error("Error fetching push token:", error);
      }
    };

    registerForPushNotifications();
  }, [userId]);

  // Your existing local notification function stays here...
  const scheduleLocalNotification = async (title: string, body: string, secondsFromNow: number = 1) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
      });
    } catch (error) {
      console.error("Error scheduling notification:", error);
    }
  };

  return { scheduleLocalNotification };
};
