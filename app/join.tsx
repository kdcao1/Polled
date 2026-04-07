import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDocFromServer, doc, setDoc, arrayUnion, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { trackEvent } from '@/utils/analytics';

export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [joinCode, setJoinCode] = useState((params.code as string) || '');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !auth.currentUser) return;

    setIsJoining(true);
    setErrorMsg('');
    trackEvent('event_join_attempt', { code_length: code.length });

    try {
      // 1. Resolve the invite code to a secure event ID
      const joinCodeDoc = await getDocFromServer(doc(db, 'joinCodes', code));

      if (!joinCodeDoc.exists()) {
        trackEvent('event_join_failed', { reason: 'code_not_found' });
        setErrorMsg("We couldn't find an event with that code.");
        setIsJoining(false);
        return;
      }

      const joinCodeData = joinCodeDoc.data();
      const secureEventId = joinCodeData.eventId as string;
      const joinCodeIdentityRequirement = joinCodeData.identityRequirement === 'linked_account'
        ? 'linked_account'
        : 'none';

      if (joinCodeIdentityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
        trackEvent('event_join_failed', { reason: 'linked_account_required' });
        setIsJoining(false);
        router.replace(`/link-account?next=${encodeURIComponent(`/join?code=${code}`)}`);
        return;
      }

      let eventDoc;
      try {
        eventDoc = await getDocFromServer(doc(db, 'events', secureEventId));
      } catch (error) {
        console.error("Error reading event during join:", error);
        trackEvent('event_join_failed', { reason: 'event_read_denied' });
        setErrorMsg("We couldn't verify that event yet. Try again in a moment.");
        setIsJoining(false);
        return;
      }

      if (!eventDoc.exists()) {
        trackEvent('event_join_failed', { reason: 'event_not_found' });
        setErrorMsg("That invite is no longer active.");
        setIsJoining(false);
        return;
      }

      const identityRequirement = eventDoc.data().identityRequirement === 'linked_account'
        ? 'linked_account'
        : joinCodeIdentityRequirement;

      if (identityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
        trackEvent('event_join_failed', { reason: 'linked_account_required' });
        setIsJoining(false);
        router.replace(`/link-account?next=${encodeURIComponent(`/join?code=${code}`)}`);
        return;
      }

      // 3. Add this event to the user's dashboard array
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const memberRef = doc(db, 'events', secureEventId, 'members', auth.currentUser.uid);
      try {
        await setDoc(memberRef, {
          uid: auth.currentUser.uid,
          joinedAt: serverTimestamp(),
          role: 'participant',
        }, { merge: true });
      } catch (error) {
        console.error("Error creating event membership:", error);
        trackEvent('event_join_failed', { reason: 'member_write_denied' });
        setErrorMsg("We couldn't add you to that event.");
        setIsJoining(false);
        return;
      }

      try {
        await setDoc(userRef, {
          joinedEvents: arrayUnion(secureEventId)
        }, { merge: true });
      } catch (error) {
        console.error("Error saving joined event to user profile:", error);
        try {
          await deleteDoc(memberRef);
        } catch (rollbackError) {
          console.error("Error rolling back failed join membership:", rollbackError);
        }
        trackEvent('event_join_failed', { reason: 'user_dashboard_write_denied' });
        setErrorMsg("We couldn't save that event to your dashboard.");
        setIsJoining(false);
        return;
      }

      trackEvent('event_joined', { event_id: secureEventId });

      // 4. Route them to the event
      router.replace(`/event/${secureEventId}`);

    } catch (error) {
      console.error("Error joining event:", error);
      trackEvent('event_join_failed', { reason: 'unknown_error' });
      setErrorMsg("We couldn't join that event. Try again in a moment.");
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
