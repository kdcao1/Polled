import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, usePathname, useGlobalSearchParams } from 'expo-router'; // Add useGlobalSearchParams
import { SafeAreaView } from 'react-native-safe-area-context';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '../hooks/useAuth';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { doc, getDoc, getDocFromServer, onSnapshot, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { trackScreenView } from '@/utils/analytics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { maintenanceConfig } from '@/config/env';
import '../global.css';

function ToastNavigationReset({ routeKey }: { routeKey: string }) {
  const toast = useToast();
  const previousRouteKeyRef = useRef(routeKey);

  useEffect(() => {
    if (previousRouteKeyRef.current !== routeKey) {
      toast.closeAll();
      previousRouteKeyRef.current = routeKey;
    }
  }, [routeKey, toast]);

  return null;
}

type MaintenanceState = {
  enabled: boolean;
  message: string;
};

const DEFAULT_MAINTENANCE_MESSAGE = 'Polled is temporarily down for maintenance.';

function readMaintenanceState(snapshot: DocumentSnapshot): MaintenanceState {
  const data = snapshot.data();
  return {
    enabled: data?.maintenanceMode === true,
    message:
      typeof data?.maintenanceMessage === 'string' && data.maintenanceMessage.trim()
        ? data.maintenanceMessage
        : DEFAULT_MAINTENANCE_MESSAGE,
  };
}

function maintenanceStatusUrl() {
  if (maintenanceConfig.statusUrl) return maintenanceConfig.statusUrl;
  if (Platform.OS === 'web') return 'https://admin.polled.app/api/public/maintenance';
  return '';
}

async function fetchMaintenanceStateFromEndpoint(): Promise<MaintenanceState | null> {
  const url = maintenanceStatusUrl();
  if (!url) return null;

  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Maintenance endpoint returned ${response.status}`);

  const data = await response.json();
  return {
    enabled: data?.enabled === true,
    message:
      typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : DEFAULT_MAINTENANCE_MESSAGE,
  };
}

export default function RootLayout() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isProfileChecking, setIsProfileChecking] = useState(true);
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);
  useNotifications(user?.uid);
  
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams();
  const routeSearch = new URLSearchParams(params as any).toString();
  const routeKey = routeSearch ? `${pathname}?${routeSearch}` : pathname;

  useEffect(() => {
    trackScreenView(routeKey);
  }, [routeKey]);

  useEffect(() => {
    let isMounted = true;
    let hasServerMaintenanceValue = false;
    const maintenanceRef = doc(db, 'appConfig', 'global');

    const applyEndpointFallback = async () => {
      try {
        const endpointState = await fetchMaintenanceStateFromEndpoint();
        if (isMounted && endpointState) setMaintenance(endpointState);
        if (isMounted && !endpointState) setMaintenance({ enabled: false, message: '' });
      } catch (error) {
        console.warn('Maintenance status endpoint failed:', error);
        if (isMounted) setMaintenance({ enabled: false, message: '' });
      }
    };

    getDocFromServer(maintenanceRef)
      .then((snapshot) => {
        hasServerMaintenanceValue = true;
        if (isMounted) setMaintenance(readMaintenanceState(snapshot));
      })
      .catch((error) => {
        console.warn('Maintenance mode check failed:', error);
        applyEndpointFallback();
      });

    const unsubscribe = onSnapshot(
      maintenanceRef,
      (snapshot) => {
        if (snapshot.metadata.fromCache && !hasServerMaintenanceValue) return;
        if (!snapshot.metadata.fromCache) hasServerMaintenanceValue = true;
        if (isMounted) setMaintenance(readMaintenanceState(snapshot));
      },
      (error) => {
        console.warn('Maintenance mode listener failed:', error);
        applyEndpointFallback();
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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
        const isPublicRoute = inIndexScreen || inLoginScreen || inOnboardingScreen;
        
        const isIntentionalAction = 
          pathname === '/create' || 
          pathname === '/join' || 
          pathname.startsWith('/event/');

        // 2. IF COMPLETELY LOGGED OUT
        if (!user) {
          if (isIntentionalAction) {
            router.replace(`/onboarding?next=${encodedPath}`);
          } else if (!isPublicRoute) {
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
          if (!isPublicRoute) {
            router.replace(`/onboarding?next=${encodedPath}`);
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

  if (isAuthLoading || isProfileChecking || maintenance === null) {
    return (
      <View className="flex-1 justify-center items-center bg-zinc-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (maintenance.enabled) {
    return (
      <View className="flex-1 justify-center items-center bg-zinc-900 px-6">
        <View className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <Text className="text-2xl font-bold text-zinc-50">Maintenance Mode</Text>
          <Text className="mt-3 text-base text-zinc-300">{maintenance.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <GluestackUIProvider mode="dark">
          <ToastNavigationReset routeKey={routeKey} />
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
              <Stack.Screen name="debug" options={{ headerShown: false }} />
              <Stack.Screen name="event/[id]" options={{ title: 'Polled', headerLeft: () => null }} />
              <Stack.Screen
                name="edit/[id]"
                options={{
                  title: 'Edit Event',
                  presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal',
                  animation: Platform.OS === 'web' ? 'none' : 'default',
                  contentStyle: {
                    backgroundColor: Platform.OS === 'web' ? 'transparent' : '#18181b',
                  },
                }}
              />
            </Stack>
          </SafeAreaView>
        </GluestackUIProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
