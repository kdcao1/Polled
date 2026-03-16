import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { db, auth } from '../config/firebaseConfig';

export default function JoinScreen() {
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !auth.currentUser) return;

    setIsJoining(true);
    setErrorMsg('');

    try {
      // 1. Search the database for an event containing this join code
      const q = query(collection(db, 'events'), where('joinCode', '==', code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMsg("We couldn't find an event with that code.");
        setIsJoining(false);
        return;
      }

      // 2. We found it! Grab the secure Firestore ID from the document
      const eventDoc = querySnapshot.docs[0];
      const secureEventId = eventDoc.id;

      // 3. Add this event to the user's dashboard array
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        joinedEvents: arrayUnion(secureEventId)
      }, { merge: true });

      // 4. Route them to the event
      router.push(`/event/${secureEventId}`);

    } catch (error) {
      console.error("Error joining event:", error);
      setErrorMsg("Something went wrong. Try again.");
      setIsJoining(false);
    }
  };

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

          <Heading size="2xl" className="text-zinc-50 text-center">Enter Invite Code</Heading>
          
          <VStack className="gap-4">
            <Input variant="outline" size="xl" className="border-zinc-700">
              <InputField
                placeholder="e.g., XJ42K9A1"
                maxLength={8}
                placeholderTextColor="#a1a1aa"
                value={joinCode}
                onChangeText={(text) => {
                  setJoinCode(text);
                  setErrorMsg(''); 
                }}
                autoCapitalize="characters"
                className="text-zinc-50"
                autoFocus
              />
            </Input>

            {/* Display error message if the code is wrong */}
            {errorMsg ? <Text className="text-red-400 text-center font-semibold">{errorMsg}</Text> : null}
            
            <Button 
              size="xl" 
              action="primary" 
              className="bg-blue-600 border-0" 
              onPress={handleJoin}
              isDisabled={isJoining || joinCode.length < 5}
            >
              <ButtonText className="font-bold text-white">
                {isJoining ? "Searching..." : "Join Event"}
              </ButtonText>
            </Button>

            <Button size="xl" variant="link" onPress={() => router.back()} isDisabled={isJoining}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}