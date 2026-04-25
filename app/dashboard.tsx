import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { useRouter } from 'expo-router';
import { deleteDoc, doc, updateDoc, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useDashboard, EventData } from '../hooks/useDashboard';
import { Settings, MoreVertical } from 'lucide-react-native';
import EventActionModal from '@/components/custom/EventActionModal';
import EventSummaryBadge from '@/components/custom/EventSummaryBadge'; // Ensure this path matches where you saved it!
import { ensureAnalyticsJourneyStarted, trackEvent } from '@/utils/analytics';
import { getEventStatusLabel } from '@/utils/eventStatus';
import { deleteEventCompletely } from '@/utils/eventDeletion';
import { ensureJoinCodeForEvent } from '@/utils/joinCodes';

export default function DashboardScreen() {
  const { events, loading, removeEvent, updateEvent } = useDashboard();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const toast = useToast();

  const currentUid = auth.currentUser?.uid;

  const [actionEvent, setActionEvent] = useState<EventData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const openEvent = (event: EventData) => {
    router.push({
      pathname: '/event/[id]',
      params: {
        id: event.id,
        title: event.title ?? '',
        time: event.time ?? '',
        location: event.location ?? '',
        status: event.status ?? 'voting',
        joinCode: event.joinCode ?? '',
        organizerId: event.organizerId ?? '',
      },
    });
  };

  const openEditEvent = (event: EventData) => {
    router.push({
      pathname: '/edit/[id]',
      params: {
        id: event.id,
        title: event.title ?? '',
        time: event.time ?? '',
        location: event.location ?? '',
        joinCode: event.joinCode ?? '',
        identityRequirement: event.identityRequirement === 'linked_account' ? 'linked_account' : 'none',
        status: event.status ?? 'voting',
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!actionEvent) return;
    setIsDeleting(true);

    try {
      if (actionEvent.organizerId === currentUid) {
        await deleteEventCompletely(actionEvent.id);
      } else {
        const userRef = doc(db, 'users', currentUid!);
        await updateDoc(userRef, { joinedEvents: arrayRemove(actionEvent.id) });
        await deleteDoc(doc(db, 'events', actionEvent.id, 'members', currentUid!));
      }
      
      removeEvent(actionEvent.id);
      trackEvent('event_removed_from_dashboard', {
        event_id: actionEvent.id,
        organizer_removed_event: actionEvent.organizerId === currentUid,
      });
      setActionEvent(null);
    } catch (error) {
      console.error('Error removing event:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEndEvent = async () => {
    if (!actionEvent || actionEvent.organizerId !== currentUid || actionEvent.status === 'ended') return;
    setIsEnding(true);

    try {
      await updateDoc(doc(db, 'events', actionEvent.id), {
        status: 'ended',
        endedAt: serverTimestamp(),
      });

      updateEvent(actionEvent.id, { status: 'ended' });
      trackEvent('event_ended_manual', { event_id: actionEvent.id, source: 'dashboard_menu' });
      setActionEvent(null);

      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-green-400 font-bold text-sm">Event Ended</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Voting is now closed for everyone.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } catch (error) {
      console.error('Error ending event:', error);
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Could not end event</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Please try again in a moment.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleRestartEvent = async () => {
    if (!actionEvent || actionEvent.organizerId !== currentUid || actionEvent.status !== 'ended') return;
    setIsRestarting(true);

    try {
      await updateDoc(doc(db, 'events', actionEvent.id), {
        status: 'voting',
        endedAt: null,
        scheduledAt: null,
      });
      const joinCode = await ensureJoinCodeForEvent(actionEvent.id, actionEvent);

      updateEvent(actionEvent.id, { status: 'voting', scheduledAt: null, joinCode });
      trackEvent('event_restarted_manual', { event_id: actionEvent.id, source: 'dashboard_menu' });
      setActionEvent(null);

      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-green-400 font-bold text-sm">Event Restarted</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Voting is open again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } catch (error) {
      console.error('Error restarting event:', error);
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Could not restart event</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Please try again in a moment.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsRestarting(false);
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
              onPress={() => {
                trackEvent('settings_opened');
                router.push('/settings');
              }}
              className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 items-center justify-center"
            >
              <Settings size={20} color="#a1a1aa" />
            </TouchableOpacity>

            <Button
              size="sm"
              variant="outline"
              className="border-zinc-600"
              onPress={() => {
                trackEvent('dashboard_cta_clicked', { destination: 'join' });
                router.push('/join');
              }}
            >
              <ButtonText className="text-zinc-50 font-bold">Join</ButtonText>
            </Button>
            
            <Button
              size="sm"
              action="primary"
              className="bg-blue-600 border-0"
              onPress={() => {
                trackEvent('dashboard_cta_clicked', { destination: 'create' });
                void ensureAnalyticsJourneyStarted('event_creation_flow', {
                  entry_point: 'dashboard_header',
                });
                router.push('/create');
              }}
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
              onPress={() => {
                trackEvent('dashboard_cta_clicked', { destination: 'create_empty_state' });
                void ensureAnalyticsJourneyStarted('event_creation_flow', {
                  entry_point: 'dashboard_empty_state',
                });
                router.push('/create');
              }}
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
                  onPress={() => {
                    trackEvent('event_opened', { event_id: event.id });
                    openEvent(event);
                  }}
                  className="bg-zinc-800 p-5 rounded-2xl border border-zinc-700 active:bg-zinc-700"
                >
                  <VStack className="gap-4">
                    {/* Header: Title, Join Code, and Action */}
                    <HStack className="justify-between items-center gap-3">
                      <Text
                        className="text-zinc-50 font-bold text-xl flex-1"
                        {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}
                      >
                        {event.title}
                      </Text>

                      <HStack className="items-center gap-2 shrink-0">
                        <Text className="text-zinc-400 text-sm font-medium">Code:</Text>
                        <Box className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                          <Text className="text-zinc-300 font-mono text-xs font-bold tracking-widest">
                            {event.joinCode ?? event.id}
                          </Text>
                        </Box>
                      </HStack>

                      {/* --- 3. THE FIXED THREE DOT BUTTON --- */}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation(); 
                          trackEvent('event_action_menu_opened', { event_id: event.id });
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
                        <Text className={`text-sm font-bold ${event.status === 'voting' ? 'text-green-400' : 'text-red-300'}`}>
                          {getEventStatusLabel(event)}
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
        isEnding={isEnding}
        isRestarting={isRestarting}
        onClose={() => setActionEvent(null)}
        onEdit={(id) => {
          const targetEvent = actionEvent && actionEvent.id === id ? actionEvent : events.find((event) => event.id === id);
          setActionEvent(null);
          if (targetEvent) {
            openEditEvent(targetEvent);
            return;
          }

          router.push(`/edit/${id}`);
        }}
        onConfirmAction={handleConfirmAction}
        onEndEvent={handleEndEvent}
        onRestartEvent={handleRestartEvent}
      />

    </Box>
  );
}
