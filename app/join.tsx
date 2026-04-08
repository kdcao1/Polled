import React, { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDoc, doc, setDoc, arrayUnion, serverTimestamp, writeBatch } from 'firebase/firestore';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { abandonAnalyticsJourney, clearAnalyticsJourney, continueAnalyticsJourney, ensureAnalyticsJourneyStarted, trackEvent } from '@/utils/analytics';

export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [joinCode, setJoinCode] = useState((params.code as string) || '');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void ensureAnalyticsJourneyStarted('join_flow', {
      entry_screen: 'join',
      has_prefilled_code: !!params.code,
    });

    if (params.code) {
      void ensureAnalyticsJourneyStarted('pending_vote_from_link_flow', {
        source: 'invite_link',
        code_length: String(params.code).length,
      });
    }

    return () => {
      void abandonAnalyticsJourney('join_flow', 'join_screen', {
        task: 'join_event',
      });
    };
  }, [params.code]);

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !auth.currentUser) return;

    setIsJoining(true);
    setErrorMsg('');
    trackEvent('event_join_attempt', { code_length: code.length });

    try {
      // 1. Resolve the invite code to a secure event ID
      const joinCodeDoc = await getDoc(doc(db, 'joinCodes', code));

      if (!joinCodeDoc.exists()) {
        trackEvent('event_join_failed', { reason: 'code_not_found' });
        setErrorMsg("We couldn't find an event with that code.");
        setIsJoining(false);
        return;
      }

      const secureEventId = joinCodeDoc.data().eventId as string;
      const eventDoc = await getDoc(doc(db, 'events', secureEventId));

      if (!eventDoc.exists()) {
        trackEvent('event_join_failed', { reason: 'event_not_found' });
        setErrorMsg("That invite is no longer active.");
        setIsJoining(false);
        return;
      }

      const identityRequirement = eventDoc.data().identityRequirement === 'linked_account'
        ? 'linked_account'
        : 'none';

      if (identityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
        trackEvent('event_join_failed', { reason: 'linked_account_required' });
        setIsJoining(false);
        router.replace(`/link-account?next=${encodeURIComponent(`/join?code=${code}`)}`);
        return;
      }

      // 3. Add this event to the user's dashboard array
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const memberRef = doc(db, 'events', secureEventId, 'members', auth.currentUser.uid);
      const batch = writeBatch(db);
      batch.set(userRef, {
        joinedEvents: arrayUnion(secureEventId)
      }, { merge: true });
      batch.set(memberRef, {
        uid: auth.currentUser.uid,
        joinedAt: serverTimestamp(),
        role: 'participant',
      }, { merge: true });
      await batch.commit();

      trackEvent('event_joined', { event_id: secureEventId });
      await clearAnalyticsJourney('join_flow');
      await continueAnalyticsJourney(
        'pending_vote_from_link_flow',
        `event_vote_flow:${secureEventId}:${auth.currentUser.uid}`,
        {
          event_id: secureEventId,
          source: 'invite_link',
        }
      );

      // 4. Route them to the event
      router.replace(`/event/${secureEventId}`);

    } catch (error) {
      console.error("Error joining event:", error);
      trackEvent('event_join_failed', { reason: 'unknown_error' });
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
