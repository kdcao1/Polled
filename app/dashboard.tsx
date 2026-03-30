import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { doc, deleteDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useDashboard, EventData } from '../hooks/useDashboard';
import { Settings, MoreVertical } from 'lucide-react-native';
import EventActionModal from '@/components/custom/EventActionModal';
import EventSummaryBadge from '@/components/custom/EventSummaryBadge'; // Ensure this path matches where you saved it!

export default function DashboardScreen() {
  const { events, loading, removeEvent } = useDashboard();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const currentUid = auth.currentUser?.uid;

  const [actionEvent, setActionEvent] = useState<EventData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmAction = async () => {
    if (!actionEvent) return;
    setIsDeleting(true);

    try {
      const userRef = doc(db, 'users', currentUid!);
      await updateDoc(userRef, { joinedEvents: arrayRemove(actionEvent.id) });
      
      // If they are the organizer, delete the whole event from the database
      if (actionEvent.organizerId === currentUid) {
        await deleteDoc(doc(db, 'events', actionEvent.id));
      }
      
      removeEvent(actionEvent.id);
      setActionEvent(null);
    } catch (error) {
      console.error('Error removing event:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 items-center px-4">
      <VStack
        className="w-full flex-1 pt-4 gap-6"
        style={{ maxWidth: isMobile ? undefined : 640 }}
      >
        <HStack className="justify-between items-center w-full">
          <Heading size="2xl" className="text-zinc-50">Events</Heading>

          <HStack className="gap-3 items-center">
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => router.push('/settings')}
              className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 items-center justify-center"
            >
              <Settings size={20} color="#a1a1aa" />
            </TouchableOpacity>

            <Button
              size="sm"
              variant="outline"
              className="border-zinc-600"
              onPress={() => router.push('/join')}
            >
              <ButtonText className="text-zinc-50 font-bold">Join</ButtonText>
            </Button>
            
            <Button
              size="sm"
              action="primary"
              className="bg-blue-600 border-0"
              onPress={() => router.push('/create')}
            >
              <ButtonText className="font-bold text-white">New</ButtonText>
            </Button>
          </HStack>
        </HStack>

        {loading && events.length === 0 ? (
          <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
        ) : events.length === 0 ? (
          <VStack className="items-center mt-20 gap-6">
            <Text className="text-zinc-400 text-center text-lg">
              You're not in any events yet...
            </Text>
            <Button
              size="xl"
              action="primary"
              className="bg-blue-600 border-0 w-full"
              onPress={() => router.push('/create')}
            >
              <ButtonText className="font-bold text-white">Create New Event</ButtonText>
            </Button>
          </VStack>
        ) : (
          <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
            <VStack className="gap-4 pb-12">
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.navigate(`/event/${event.id}`)}
                  className="bg-zinc-800 p-5 rounded-2xl border border-zinc-700 active:bg-zinc-700"
                >
                  <VStack className="gap-4">
                    {/* Header: Title, Join Code, and Action */}
                    <HStack className="justify-between items-start">
                      <VStack className="flex-1 mr-3 gap-1">
                        <Text className="text-zinc-50 font-bold text-xl">{event.title}</Text>
                        <HStack className="items-center gap-2 mt-1">
                          <Text className="text-zinc-400 text-sm font-medium">Code:</Text>
                          <Box className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                            <Text className="text-zinc-300 font-mono text-xs font-bold tracking-widest">
                              {event.joinCode ?? event.id}
                            </Text>
                          </Box>
                        </HStack>
                      </VStack>

                      {/* --- 3. THE FIXED THREE DOT BUTTON --- */}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation(); 
                          setActionEvent(event); // This correctly triggers the modal!
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        className="w-8 h-8 rounded-full bg-zinc-900/50 items-center justify-center border border-zinc-700/50 shrink-0"
                      >
                        <MoreVertical size={18} color="#a1a1aa" />
                      </TouchableOpacity>
                    </HStack>

                    {/* Event Details Grid */}
                    <VStack className="gap-2 bg-zinc-900/30 p-3 rounded-xl border border-zinc-700/50">
                      <HStack className="justify-between items-center">
                        <Text className="text-zinc-400 text-sm font-medium">Status</Text>
                        <Text className={`text-sm font-bold ${event.status === 'voting' ? 'text-green-400' : 'text-zinc-500'}`}>
                          {event.status === 'voting' ? 'Active' : 'Closed'}
                        </Text>
                      </HStack>
                      
                      <HStack className="justify-between items-center">
                        <Text className="text-zinc-400 text-sm font-medium">Time</Text>
                        <Text className="text-zinc-50 font-semibold text-sm">{event.time || 'TBD'}</Text>
                      </HStack>
                      
                      <HStack className="justify-between items-center">
                        <Text className="text-zinc-400 text-sm font-medium">Location</Text>
                        <Text className="text-zinc-50 font-semibold text-sm text-right max-w-[180px]" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
                          {event.location || 'TBD'}
                        </Text>
                      </HStack>
                    </VStack>

                    {/* RESTORED SUMMARY BADGE */}
                    <EventSummaryBadge event={event} />

                  </VStack>
                </TouchableOpacity>
              ))}
            </VStack>
          </ScrollView>
        )}
      </VStack>

      <EventActionModal
        event={actionEvent}
        currentUid={currentUid}
        isDeleting={isDeleting}
        onClose={() => setActionEvent(null)}
        onEdit={(id) => {
          setActionEvent(null);
          router.push(`/edit/${id}`);
        }}
        onConfirmAction={handleConfirmAction}
      />

    </Box>
  );
}