import { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname, useGlobalSearchParams } from 'expo-router'; // Add useGlobalSearchParams
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '../hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { trackScreenView } from '@/utils/analytics';
import '../global.css';

export default function RootLayout() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isProfileChecking, setIsProfileChecking] = useState(true);
  const { scheduleLocalNotification } = useNotifications();
  
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams();

  useEffect(() => {
    const searchString = new URLSearchParams(params as any).toString();
    const fullPath = searchString ? `${pathname}?${searchString}` : pathname;
    trackScreenView(fullPath);
  }, [pathname, params]);

  useEffect(() => {
    if (isAuthLoading) return;

    const checkUserProfile = async () => {
      try {
        // 1. Move the URL processing INSIDE the try block
        const searchString = new URLSearchParams(params as any).toString();
        const fullPath = searchString ? `${pathname}?${searchString}` : pathname;
        const encodedPath = encodeURIComponent(fullPath);

        const inIndexScreen = pathname === '/'; 
        const inOnboardingScreen = pathname === '/onboarding';
        const inLoginScreen = pathname === '/login';
        const isPublicRoute = inIndexScreen || inLoginScreen;
        
        const isIntentionalAction = 
          pathname === '/create' || 
          pathname === '/join' || 
          pathname.startsWith('/event/');

        // 2. IF COMPLETELY LOGGED OUT
        if (!user) {
          if (!isPublicRoute) {
            router.replace(`/?next=${encodedPath}`);
          }
          return; // The finally block will still run!
        }

        // 3. IF LOGGED IN (Check for Profile)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const hasName = userDoc.exists() && userDoc.data().displayName;

        if (hasName) {
          if (isPublicRoute || inOnboardingScreen) {
            router.replace('/dashboard');
          }
        } else {
          if (isIntentionalAction) {
            router.replace(`/onboarding?next=${encodedPath}`);
          } else if (!isPublicRoute && !inOnboardingScreen) {
            router.replace('/onboarding');
          }
        }
      } catch (error) {
        // Now if the URL parsing or Firebase fails, it logs here instead of breaking the app
        console.error("Routing Guard Error:", error);
      } finally {
        // This is guaranteed to run, turning off the loading screen
        setIsProfileChecking(false);
      }
    };

    checkUserProfile();
  }, [user, isAuthLoading, pathname]); 

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
