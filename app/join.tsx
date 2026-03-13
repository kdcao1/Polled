import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';

export default function JoinScreen() {
  const [joinCode, setJoinCode] = useState('');
  const router = useRouter();

  const handleJoin = () => {
    if (joinCode.trim()) {
      router.push(`/event/${joinCode.toUpperCase().trim()}`);
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 justify-center px-8">
      <VStack className="gap-8">
        <Heading size="2xl" className="text-zinc-50 text-center">Enter Invite Code</Heading>
        
        <VStack className="gap-4">
          <Input variant="outline" size="xl" className="border-zinc-700">
            <InputField
              placeholder="e.g., XJ42K"
              placeholderTextColor="#a1a1aa"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              className="text-zinc-50"
              autoFocus
            />
          </Input>
          
          <Button size="xl" action="primary" className="bg-blue-600 border-0" onPress={handleJoin}>
            <ButtonText className="font-bold text-white">Join Event</ButtonText>
          </Button>

          <Button size="xl" variant="link" onPress={() => router.back()}>
            <ButtonText className="text-zinc-400">Cancel</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
}