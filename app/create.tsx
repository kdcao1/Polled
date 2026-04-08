import React, { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useEvents } from '../hooks/useEvents'; 
import { abandonAnalyticsJourney, ensureAnalyticsJourneyStarted } from '@/utils/analytics';

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const { createNewEvent } = useEvents();
  const router = useRouter();

  useEffect(() => {
    void ensureAnalyticsJourneyStarted('event_creation_flow', {
      entry_screen: 'create',
    });

    return () => {
      void abandonAnalyticsJourney('event_creation_flow', 'create_screen', {
        task: 'event_creation',
      });
    };
  }, []);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <Box className="flex-1 bg-zinc-900 justify-center items-center px-8">
        <VStack className="gap-8 w-full max-w-sm">
          <Button variant="link" onPress={() => {if (router.canGoBack()) {
              router.back(); 
            } else {
              router.replace('/dashboard');
            }}}
            className="self-start p-0 mb-1"
          >
            <ButtonText className="text-blue-500">← Back</ButtonText>
          </Button>
          <Heading size="2xl" className="text-zinc-50 text-center">What's The Plan?</Heading>
          
          <VStack className="gap-4">
            <Input variant="outline" size="xl" className="border-zinc-700">
              <InputField
                placeholder="e.g., Friday Night Dinner"
                placeholderTextColor="#a1a1aa"
                value={title}
                onChangeText={setTitle}
                className="text-zinc-50"
                autoFocus // Automatically pops up the keyboard!
              />
            </Input>
            
            <Button size="xl" action="primary" className="bg-blue-600 border-0" onPress={() => title.trim() && createNewEvent(title)}>
              <ButtonText className="font-bold text-white">Create</ButtonText>
            </Button>

            <Button size="xl" variant="link" onPress={() => router.back()}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
