import React from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { useDashboard } from '../hooks/useDashboard';

export default function DashboardScreen() {
  const { events, loading } = useDashboard();
  const router = useRouter();

  return (
    <Box className="flex-1 bg-zinc-900 justify-center items-center px-8">
      <VStack className="w-full max-w-sm flex-1 pt-12 gap-6">
        
        {/* Updated Header with Action Buttons */}
        <HStack className="justify-between items-center w-full">
          <Heading size="2xl" className="text-zinc-50">Events</Heading>
          
          <HStack className="gap-3">
            <Button size="sm" variant="outline" className="border-zinc-600" onPress={() => router.push('/join')}>
              <ButtonText className="text-zinc-50 font-bold">Join</ButtonText>
            </Button>
            
            <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => router.push('/create')}>
              <ButtonText className="font-bold text-white">New</ButtonText>
            </Button>
          </HStack>
        </HStack>

        {/* Loading State */}
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
        ) : events.length === 0 ? (
          
          /* Empty State */
          <VStack className="items-center mt-20 gap-6">
            <Text className="text-zinc-400 text-center text-lg">You're not in any events yet...</Text>
            <Button size="xl" action="primary" className="bg-blue-600 border-0 w-full" onPress={() => router.push('/create')}>
              <ButtonText className="font-bold text-white">Create One Now</ButtonText>
            </Button>
          </VStack>

        ) : (
          
          /* Events List */
          <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
            <VStack className="gap-4 pb-12">
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.push(`/event/${event.id}`)}
                  className="bg-zinc-800 p-5 rounded-2xl border border-zinc-700 active:bg-zinc-700"
                >
                  <HStack className="justify-between items-center">
                    <VStack className="gap-1">
                      <Text className="text-zinc-50 font-bold text-lg">{event.title}</Text>
                      <Text className="text-zinc-400 text-sm">Code: {event.id}</Text>
                    </VStack>
                    
                    {/* Status Pill */}
                    <Box className={`px-3 py-1 rounded-full ${event.status === 'voting' ? 'bg-blue-900/50 border border-blue-700' : 'bg-zinc-700 border border-zinc-600'}`}>
                      <Text className={`text-xs font-bold ${event.status === 'voting' ? 'text-blue-400' : 'text-zinc-400'}`}>
                        {event.status === 'voting' ? 'Active' : 'Closed'}
                      </Text>
                    </Box>
                  </HStack>
                </TouchableOpacity>
              ))}
            </VStack>
          </ScrollView>

        )}
      </VStack>
    </Box>
  );
}