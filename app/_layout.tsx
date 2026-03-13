import { Stack } from 'expo-router';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAuth } from '../hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';
import '../global.css';

export default function RootLayout() {
  const { user, isLoading } = useAuth();

  // Show a dark spinner while Firebase initializes
  if (isLoading) {
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
          headerStyle: {
            backgroundColor: '#18181b',
          },
          headerTintColor: '#f4f4f5',
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: '#18181b',
          },
        }}
      >
        {/* Landing Screen */}
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        
        {/* Create Flow */}
        <Stack.Screen 
          name="create" 
          options={{ 
            title: 'New Event',
            headerShown: true,
          }} 
        />
        
        {/* Join Flow */}
        <Stack.Screen 
          name="join" 
          options={{ 
            title: 'Join Event',
            headerShown: true,
          }} 
        />

        {/* The Main Event View */}
        <Stack.Screen 
          name="event/[id]" 
          options={{ 
            title: 'Polled', 
            headerShown: true,
            // You can hide the back button here if you want it to feel like a dashboard
            headerLeft: () => null, 
          }} 
        />
      </Stack>
    </GluestackUIProvider>
  );
}