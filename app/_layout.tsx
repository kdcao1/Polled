import { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '../hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import '../global.css';

export default function RootLayout() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isProfileChecking, setIsProfileChecking] = useState(true);
  
  const pathname = usePathname();
  const router = useRouter();

  // THE GLOBAL ROUTE GUARD
  useEffect(() => {
    if (isAuthLoading) return;

    const checkUserProfile = async () => {
      if (!user) {
        setIsProfileChecking(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const hasName = userDoc.exists() && userDoc.data().displayName;
        
        const inIndexScreen = pathname === '/'; 
        const inOnboardingScreen = pathname === '/onboarding';
        
        const isIntentionalAction = 
          pathname === '/create' || 
          pathname === '/join' || 
          pathname.startsWith('/event/');

        if (hasName) {
          if (inIndexScreen || inOnboardingScreen) {
            router.replace('/dashboard');
          }
        } else {
          if (isIntentionalAction) {
            router.replace(`/onboarding?next=${pathname}`);
          } else if (!inIndexScreen && !inOnboardingScreen) {
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
    <GluestackUIProvider mode="dark">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#18181b' },
          headerTintColor: '#f4f4f5',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#18181b' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'New Event' }} />
        <Stack.Screen name="join" options={{ title: 'Join Event' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Polled', headerLeft: () => null }} />
      </Stack>
    </GluestackUIProvider>
  );
}