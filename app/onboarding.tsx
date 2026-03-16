import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { next } = useLocalSearchParams();

  const handleSaveName = async () => {
    if (!name.trim() || !auth.currentUser) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        displayName: name.trim(),
        joinedEvents: [] 
      }, { merge: true });

      if (typeof next === 'string') {
        router.replace(decodeURIComponent(next) as any);
      } else {
        router.replace('/dashboard');
      }

    } catch (error) {
      console.error("Error saving name:", error);
      setIsSaving(false);
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 justify-center items-center px-8">
      <VStack className="gap-8 w-full max-w-sm">
        
        <VStack className="gap-2 items-center">
          <Heading size="2xl" className="text-zinc-50 text-center">What's your name?</Heading>
          <Text className="text-zinc-400 text-center text-md">
            Your friends need to know who is voting!
          </Text>
        </VStack>
        
        <VStack className="gap-4">
          <Input variant="outline" size="xl" className="border-zinc-700">
            <InputField
              placeholder="full name or nickname would be nice..."
              placeholderTextColor="#a1a1aa"
              value={name}
              onChangeText={setName}
              className="text-zinc-50"
              autoFocus
            />
          </Input>
          
          <Button 
            size="xl" 
            action="primary" 
            className="bg-blue-600 border-0" 
            onPress={handleSaveName}
            isDisabled={isSaving || !name.trim()}
          >
            <ButtonText className="font-bold text-white">
              {isSaving ? "Saving..." : "Continue"}
            </ButtonText>
          </Button>
        </VStack>

      </VStack>
    </Box>
  );
}