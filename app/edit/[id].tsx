import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { trackEvent } from '@/utils/analytics';
import { parseScheduledEventDate } from '@/utils/eventStatus';

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Grabs the event ID from the URL
  const toast = useToast();
  const currentUid = auth.currentUser?.uid;

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [identityRequirement, setIdentityRequirement] = useState<'none' | 'linked_account'>('none');
  const [eventStatus, setEventStatus] = useState<'voting' | 'ended'>('voting');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // --- REUSABLE TOAST HELPER ---
  const showToast = (toastTitle: string, description: string, type: 'success' | 'error') => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast 
          nativeID={id} 
          className={`mt-24 px-4 py-3 rounded-xl border ${type === 'success' ? 'bg-green-600/20 border-green-500/50' : 'bg-red-600/20 border-red-500/50'}`}
        >
          <VStack>
            <ToastTitle className={`font-bold text-sm ${type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {toastTitle}
            </ToastTitle>
            <ToastDescription className="text-zinc-300 text-xs mt-0.5">
              {description}
            </ToastDescription>
          </VStack>
        </Toast>
      ),
    });
  };

  // --- FETCH EXISTING EVENT DATA ---
  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'events', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Security Check: Boot them out if they aren't the organizer
          if (data.organizerId !== currentUid) {
            showToast('Access Denied', 'Only the organizer can edit this event.', 'error');
            router.back();
            return;
          }

          setTitle(data.title || '');
          setTime(data.time || '');
          setLocation(data.location || '');
          setIdentityRequirement(data.identityRequirement === 'linked_account' ? 'linked_account' : 'none');
          setEventStatus(data.status === 'ended' ? 'ended' : 'voting');
        } else {
          showToast('Not Found', 'This event no longer exists.', 'error');
          router.back();
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        showToast('Error', 'Could not load event details.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [id, currentUid]);

  // --- SAVE CHANGES TO FIRESTORE ---
  const persistEvent = async (forceEnd = false) => {
    if (!title.trim() || !id) return;

    try {
      const docRef = doc(db, 'events', id as string);
      const scheduledDate = parseScheduledEventDate(time.trim());
      const shouldEndImmediately = !!scheduledDate && scheduledDate.getTime() <= Date.now();
      const nextStatus = forceEnd || eventStatus === 'ended' || shouldEndImmediately ? 'ended' : 'voting';
      const updatePayload: Record<string, any> = {
        title: title.trim(),
        time: time.trim(),
        location: location.trim(),
        identityRequirement,
        scheduledAt: scheduledDate ? scheduledDate.toISOString() : null,
        status: nextStatus,
      };

      if (nextStatus === 'ended' && eventStatus !== 'ended') {
        updatePayload.endedAt = serverTimestamp();
      }

      if (nextStatus === 'voting') {
        updatePayload.endedAt = null;
      }

      await updateDoc(docRef, updatePayload);

      trackEvent('event_updated', {
        event_id: id as string,
        has_time: !!time.trim(),
        has_location: !!location.trim(),
        identity_requirement: identityRequirement,
        status: nextStatus,
      });

      showToast('Success', forceEnd ? 'Event ended successfully.' : 'Event updated successfully.', 'success');
      router.back(); // Slide the modal back down
    } catch (error) {
      console.error(forceEnd ? "Error ending event:" : "Error updating event:", error);
      showToast('Error', forceEnd ? 'Could not end event. Try again.' : 'Could not save changes. Try again.', 'error');
      throw error;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistEvent(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndEvent = async () => {
    if (!id || eventStatus === 'ended') return;
    setIsEnding(true);
    try {
      await updateDoc(doc(db, 'events', id as string), {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
      showToast('Success', 'Event ended successfully.', 'success');
      trackEvent('event_ended_manual', { event_id: id as string, source: 'edit_screen' });
      router.back();
    } finally {
      setIsEnding(false);
    }
  };

  const confirmEndEvent = () => {
    if (eventStatus === 'ended') return;

    Alert.alert(
      'End event?',
      'This will close voting for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Event',
          style: 'destructive',
          onPress: () => {
            void handleEndEvent();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <Box className="flex-1 bg-zinc-900 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <Box className="flex-1 bg-zinc-900 px-6 pt-6">
        <VStack className="gap-8 w-full max-w-sm self-center">
          
          {/* Header */}
          <HStack className="justify-between items-center w-full mt-2">
            <Button 
              variant="link" 
              className="p-0"
              onPress={() => router.back()}
              isDisabled={isSaving || isEnding}
            >
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
            
            <Heading size="lg" className="text-zinc-50">Edit Event</Heading>
            
            <Button 
              variant="link" 
              className="p-0"
              onPress={handleSave}
              isDisabled={isSaving || isEnding || !title.trim()}
            >
              {isSaving ? (
                <ButtonSpinner color="#3b82f6" />
              ) : (
                <ButtonText className={`font-bold ${title.trim() ? 'text-blue-500' : 'text-zinc-600'}`}>
                  Save
                </ButtonText>
              )}
            </Button>
          </HStack>

          {/* Form */}
          <VStack className="gap-5">
            <VStack className="gap-2">
              <Text className="text-zinc-300 font-medium ml-1">Event Name <Text className="text-red-500">*</Text></Text>
              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="e.g., Weekend Getaway"
                  placeholderTextColor="#a1a1aa"
                  value={title}
                  onChangeText={setTitle}
                  className="text-zinc-50 font-semibold"
                />
              </Input>
            </VStack>

            <VStack className="gap-2">
              <Text className="text-zinc-300 font-medium ml-1">Time (Optional)</Text>
              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="e.g., Friday at 7 PM"
                  placeholderTextColor="#a1a1aa"
                  value={time}
                  onChangeText={setTime}
                  className="text-zinc-50"
                />
              </Input>
            </VStack>

            <VStack className="gap-2">
              <Text className="text-zinc-300 font-medium ml-1">Location (Optional)</Text>
              <Input variant="outline" size="xl" className="border-zinc-700 bg-zinc-800">
                <InputField
                  placeholder="e.g., Downtown Arcade"
                  placeholderTextColor="#a1a1aa"
                  value={location}
                  onChangeText={setLocation}
                  className="text-zinc-50"
                />
              </Input>
            </VStack>

            <VStack className="gap-3">
              <Text className="text-zinc-300 font-medium ml-1">Who Can Vote?</Text>

              <TouchableOpacity
                activeOpacity={0.85}
                className={`rounded-2xl border p-4 ${identityRequirement === 'none' ? 'border-blue-500 bg-blue-600/10' : 'border-zinc-700 bg-zinc-800'}`}
                onPress={() => setIdentityRequirement('none')}
                disabled={isSaving || isEnding}
              >
                <VStack className="gap-1.5">
                  <Text className={`${identityRequirement === 'none' ? 'text-blue-300' : 'text-zinc-50'} font-bold text-base`}>
                    Open to onboarded users
                  </Text>
                  <Text className="text-zinc-400 text-sm leading-5">
                    Anyone who joins and sets a name can participate.
                  </Text>
                </VStack>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                className={`rounded-2xl border p-4 ${identityRequirement === 'linked_account' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-800'}`}
                onPress={() => setIdentityRequirement('linked_account')}
                disabled={isSaving || isEnding}
              >
                <VStack className="gap-1.5">
                  <Text className={`${identityRequirement === 'linked_account' ? 'text-amber-300' : 'text-zinc-50'} font-bold text-base`}>
                    Require linked account
                  </Text>
                  <Text className="text-zinc-400 text-sm leading-5">
                    Participants must link Google or email before joining and voting.
                  </Text>
                </VStack>
              </TouchableOpacity>
            </VStack>

            {!isLoading && eventStatus !== 'ended' && (
              <Button
                size="xl"
                variant="outline"
                className="border-red-500/30 bg-red-500/10 mt-2"
                onPress={confirmEndEvent}
                isDisabled={isSaving || isEnding}
              >
                {isEnding ? (
                  <ButtonSpinner color="#fca5a5" />
                ) : (
                  <ButtonText className="font-bold text-red-300">End Event</ButtonText>
                )}
              </Button>
            )}
          </VStack>

        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
