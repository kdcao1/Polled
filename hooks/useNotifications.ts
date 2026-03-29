import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const useNotifications = () => {
  
  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (Platform.OS === 'web') return; // Web doesn't use Expo Push Tokens

      const currentUser = auth.currentUser;
      if (!currentUser) return;

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
        // 1. Grab the Expo Push Token
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;

        // 2. Save it to the user's Firestore profile
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          expoPushToken: token
        });
        
      } catch (error) {
        console.error("Error fetching push token:", error);
      }
    };

    registerForPushNotifications();
  }, []);

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