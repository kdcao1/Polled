import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';

interface Props {
  visible: boolean;
  onClose: () => void;
  voterIds: string[];
}

export default function ParticipantsModal({ visible, onClose, voterIds }: Props) {
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    
    const fetchParticipants = async () => {
      setLoading(true);
      try {
        // SAFETY CHECK: Ensure voterIds is an array before mapping
        const safeVoterIds = Array.isArray(voterIds) ? voterIds : [];
        
        const fetched = await Promise.all(
          safeVoterIds.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            return {
              id: uid,
              name: userDoc.exists() ? (userDoc.data().displayName || 'Anonymous User') : 'Unknown User'
            };
          })
        );
        // Sort names alphabetically
        fetched.sort((a, b) => a.name.localeCompare(b.name));
        setParticipants(fetched);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [visible, voterIds]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        
        {/* The parent container */}
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-sm max-h-[80%] shadow-2xl z-10 flex-col">
          <Heading size="xl" className="text-zinc-50 mb-4 text-center">Active Voters</Heading>
          
          {loading ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : participants.length === 0 ? (
            <Text className="text-zinc-400 text-center py-4 mb-4">No one has voted yet.</Text>
          ) : (
            <ScrollView 
              className="w-full mb-4 shrink" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <VStack className="gap-2">
                {participants.map((p) => (
                  <HStack key={p.id} className="bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-700/50 items-center">
                    <Text className="text-zinc-100 font-medium">{p.name}</Text>
                  </HStack>
                ))}
              </VStack>
            </ScrollView>
          )}

          {/* This button should now stay locked to the bottom of the modal */}
          <Button size="lg" variant="outline" className="border-zinc-700 w-full bg-zinc-800 mt-2 shrink-0" onPress={onClose}>
            <ButtonText className="text-zinc-300 font-bold">Close</ButtonText>
          </Button>
        </View>
      </View>
    </Modal>
  );
}