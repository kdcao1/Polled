import React, { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { trackEvent } from '@/utils/analytics';
import { ActivityIndicator, Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

export default function LandingScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isProfileChecking, setIsProfileChecking] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isAuthLoading) return;

    const checkProfile = async () => {
      if (!user) {
        setIsProfileChecking(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const hasName = userDoc.exists() && !!userDoc.data().displayName;

        if (hasName) {
          router.replace('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking landing profile:', error);
      }

      setIsProfileChecking(false);
    };

    void checkProfile();
  }, [user, isAuthLoading, router]);

  if (Platform.OS !== 'web' && (isAuthLoading || isProfileChecking)) {
    return (
      <Box className="flex-1 bg-zinc-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-zinc-900 items-center justify-center px-8">
      <VStack className="gap-12 items-center w-full max-w-sm">
        
        <VStack className="gap-1 items-center">
          <Heading size="3xl" className="text-zinc-50">Polled</Heading>
          <Text size="lg" className="text-zinc-400">Stop scrolling. Start voting.</Text>
        </VStack>

        <VStack className="gap-4 w-full">
          <Button
            size="xl"
            action="primary"
            className="bg-blue-600 border-0"
            onPress={() => {
              trackEvent('landing_cta_clicked', { destination: 'create' });
              router.push('/onboarding?next=/create');
            }}
          >
            <ButtonText className="font-bold text-white">Create a New Event</ButtonText>
          </Button>
          
          <Button
            size="xl"
            variant="outline"
            action="secondary"
            className="border-zinc-600"
            onPress={() => {
              trackEvent('landing_cta_clicked', { destination: 'join' });
              router.push('/onboarding?next=/join');
            }}
          >
            <ButtonText className="text-zinc-50 font-bold">Join an Event</ButtonText>
          </Button>

          {/* --- NEW LOGIN LINK --- */}
          <HStack className="justify-center items-center mt-4 gap-1">
            <Text className="text-zinc-400 text-sm">Already have an account?</Text>
            <Button 
              size="sm" 
              variant="link" 
              className="p-0" 
              onPress={() => {
                trackEvent('landing_cta_clicked', { destination: 'login' });
                router.push('/login');
              }}
            >
              <ButtonText className="text-blue-500 font-bold">Log in</ButtonText>
            </Button>
          </HStack>
        </VStack>

      </VStack>
    </Box>
  );
}
