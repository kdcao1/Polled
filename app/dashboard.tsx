import React from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
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

function EventSummaryBadge({ event }: { event: EventData }) {
  const { summary } = event;
  if (!summary || summary.totalPolls === 0) return null;

  const top = summary.topPolls?.[0];
  const pct =
    top && top.totalVotes > 0
      ? Math.round((top.topVotes / top.totalVotes) * 100)
      : 0;

  return (
    <VStack className="mt-3 pt-3 border-t border-zinc-700 gap-1">
      <Text className="text-zinc-500 text-xs">
        {summary.totalPolls} poll{summary.totalPolls !== 1 ? 's' : ''} · {summary.totalVotes} vote{summary.totalVotes !== 1 ? 's' : ''}
      </Text>
      {top && (
        <Text className="text-zinc-400 text-xs" numberOfLines={1}>
          "{top.question}" → {top.topChoice} ({pct}%)
        </Text>
      )}
    </VStack>
  );
}

export default function DashboardScreen() {
  const { events, loading, removeEvent } = useDashboard();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const currentUid = auth.currentUser?.uid;

  const handleDelete = (event: EventData) => {
    const isOrganizer = event.organizerId === currentUid;
    const actionLabel = isOrganizer ? 'Delete' : 'Leave';
    const message = isOrganizer
      ? `"${event.title}" will be permanently deleted for everyone.`
      : `You will be removed from "${event.title}".`;

    const performDelete = async () => {
      try {
        const userRef = doc(db, 'users', currentUid!);
        await updateDoc(userRef, { joinedEvents: arrayRemove(event.id) });
        if (isOrganizer) {
          await deleteDoc(doc(db, 'events', event.id));
        }
        removeEvent(event.id);
      } catch (error) {
        console.error('Error removing event:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`${actionLabel} event?\n\n${message}`)) {
        performDelete();
      }
    } else {
      Alert.alert(`${actionLabel} Event`, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: actionLabel, style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 items-center px-4">
      <VStack
        className="w-full flex-1 pt-12 gap-6"
        style={{ maxWidth: isMobile ? undefined : 640 }}
      >
        <HStack className="justify-between items-center w-full">
          <Heading size="2xl" className="text-zinc-50">Events</Heading>

          <HStack className="gap-3">
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

        {loading ? (
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
                  onPress={() => router.push(`/event/${event.id}`)}
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

                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDelete(event);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-700 shrink-0"
                      >
                        <Text className="text-red-400 text-xs font-semibold">
                          {event.organizerId === currentUid ? 'Delete' : 'Leave'}
                        </Text>
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
                        <Text className="text-zinc-50 font-semibold text-sm text-right max-w-[180px]" numberOfLines={1}>
                          {event.location || 'TBD'}
                        </Text>
                      </HStack>
                    </VStack>

                    <EventSummaryBadge event={event} />
                  </VStack>
                </TouchableOpacity>
              ))}
            </VStack>
          </ScrollView>
        )}
      </VStack>
    </Box>
  );
}
