import { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '../hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import '../global.css';

export default function RootLayout() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isProfileChecking, setIsProfileChecking] = useState(true);
  const { scheduleLocalNotification } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();

  // THE GLOBAL ROUTE GUARD
  useEffect(() => {
    if (isAuthLoading) return;

    const checkUserProfile = async () => {
      // Define our route types
      const inIndexScreen = pathname === '/'; 
      const inOnboardingScreen = pathname === '/onboarding';
      const inLoginScreen = pathname === '/login';
      
      const isPublicRoute = inIndexScreen || inLoginScreen;
      
      const isIntentionalAction = 
        pathname === '/create' || 
        pathname === '/join' || 
        pathname.startsWith('/event/');

      // 1. IF COMPLETELY LOGGED OUT
      if (!user) {
        if (!isPublicRoute) {
          router.replace('/'); // Boot unauthorized users to the landing page
        }
        setIsProfileChecking(false);
        return;
      }

      // 2. IF LOGGED IN (Check for Profile)
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const hasName = userDoc.exists() && userDoc.data().displayName;

        if (hasName) {
          // Fully setup users shouldn't see landing, login, or onboarding
          if (isPublicRoute || inOnboardingScreen) {
            router.replace('/dashboard');
          }
        } else {
          // Logged in anonymously, but hasn't set a name yet
          if (isIntentionalAction) {
            router.replace(`/onboarding?next=${pathname}`);
          } else if (!isPublicRoute && !inOnboardingScreen) {
            router.replace('/');
          }
        }
      } catch (error) {
        console.error("Error checking global profile:", error);
      } finally {
        setIsProfileChecking(false);
      }
    };

    checkUserProfile();
  }, [user, isAuthLoading, pathname]);

  // Block the UI from rendering until BOTH Firebase Auth and the Profile Check are done
  if (isAuthLoading || isProfileChecking) {
    return (
      <View className="flex-1 justify-center items-center bg-zinc-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <GluestackUIProvider mode="dark">
        <SafeAreaView className="flex-1 bg-zinc-900">
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#18181b' },
              headerTintColor: '#f4f4f5',
              headerShown: false,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: '#18181b' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="create" options={{ title: 'New Event', presentation: 'card' }} />
            <Stack.Screen name="join" options={{ title: 'Join Event', presentation: 'card' }} />
            <Stack.Screen name="event/[id]" options={{ title: 'Polled', headerLeft: () => null }} />
            <Stack.Screen name="edit/[id]" options={{ title: 'Edit Event', presentation: 'modal' }} />
          </Stack>
        </SafeAreaView>
      </GluestackUIProvider>
    </KeyboardProvider>
  );
}