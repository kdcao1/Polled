import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { trackEvent } from '@/utils/analytics';

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Grabs the event ID from the URL
  const toast = useToast();
  const currentUid = auth.currentUser?.uid;

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- REUSABLE TOAST HELPER ---
  const showToast = (toastTitle: string, description: string, type: 'success' | 'error') => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast 
          nativeID={id} 
          className={`mt-12 px-4 py-3 rounded-xl border ${type === 'success' ? 'bg-green-600/20 border-green-500/50' : 'bg-red-600/20 border-red-500/50'}`}
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
  const handleSave = async () => {
    if (!title.trim() || !id) return;
    setIsSaving(true);

    try {
      const docRef = doc(db, 'events', id as string);
      await updateDoc(docRef, {
        title: title.trim(),
        time: time.trim(),
        location: location.trim(),
      });
      trackEvent('event_updated', {
        event_id: id as string,
        has_time: !!time.trim(),
        has_location: !!location.trim(),
      });

      showToast('Success', 'Event updated successfully.', 'success');
      router.back(); // Slide the modal back down
    } catch (error) {
      console.error("Error updating event:", error);
      showToast('Error', 'Could not save changes. Try again.', 'error');
      setIsSaving(false); // Only stop spinning if it fails, so they can try again
    }
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
              isDisabled={isSaving}
            >
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
            
            <Heading size="lg" className="text-zinc-50">Edit Event</Heading>
            
            <Button 
              variant="link" 
              className="p-0"
              onPress={handleSave}
              isDisabled={isSaving || !title.trim()}
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
          </VStack>

        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
