import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { useEvents } from '../hooks/useEvents'; 

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const { createNewEvent } = useEvents();
  const router = useRouter();

  return (
    <Box className="flex-1 bg-zinc-900 justify-center items-center px-8">
      <VStack className="gap-8 items-center w-full max-w-sm">
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
  );
}