import { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const params = useGlobalSearchParams();
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

        const serializedParams = new URLSearchParams(
          Object.entries(params).flatMap(([key, value]) => {
            if (value == null) return [];
            if (Array.isArray(value)) return value.map((item) => [key, String(item)]);
            return [[key, String(value)]];
          })
        ).toString();
        const nextPath = serializedParams ? `${pathname}?${serializedParams}` : pathname;
        
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
            router.replace(`/onboarding?next=${encodeURIComponent(nextPath)}`);
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
  }, [user, isAuthLoading, pathname, JSON.stringify(params)]);

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
          <Stack.Screen name="create" options={{ title: 'New Event', presentation: 'modal' }} />
          <Stack.Screen name="join" options={{ title: 'Join Event', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'Polled', headerLeft: () => null }} />
        </Stack>
      </SafeAreaView>
    </GluestackUIProvider>
  );
}