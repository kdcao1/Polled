import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';

import PollModal from '../../components/custom/PollModal';
import PollCard from '../../components/custom/PollCard';
import EventHeader from '../../components/custom/EventHeader';
import QRModal from '../../components/custom/QRModal';

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [eventData, setEventData] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const [activeTab, setActiveTab] = useState<'active' | 'answered'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{question?: string, choices?: string[]}>({});
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const joinLink = eventData?.joinCode ? `https://polled.app/join/${eventData.joinCode}` : `https://polled.app/join/${id}`;

  const openModal = (question = '', choices = ['', '']) => {
    setModalConfig({ question, choices });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!id || !auth.currentUser) return;
    const eventRef = doc(db, 'events', id as string);
    const unsubscribe = onSnapshot(eventRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEventData(data);
        setIsOrganizer(data.organizerId === auth.currentUser?.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const pollsRef = collection(db, 'events', id as string, 'polls');
    const q = query(pollsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPolls(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [id]);

  const handleVote = async (pollId: string, optionIndex: number, currentOptions: any[], allowMultipleVotes: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const poll = polls.find(p => p.id === pollId);
    if (poll?.expiresAt && new Date() > (poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt))) {
      alert('This poll has ended.');
      return;
    }

    const newOptions = currentOptions.map((opt) => ({ ...opt, voterIds: [...opt.voterIds] }));
    const hasVotedForThis = newOptions[optionIndex].voterIds.includes(uid);

    if (allowMultipleVotes) {
      if (hasVotedForThis) {
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter((v: string) => v !== uid);
      } else {
        newOptions[optionIndex].voterIds.push(uid);
      }
    } else {
      if (hasVotedForThis) {
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter((v: string) => v !== uid);
      } else {
        newOptions.forEach((opt) => opt.voterIds = opt.voterIds.filter((v: string) => v !== uid));
        newOptions[optionIndex].voterIds.push(uid);
      }
    }

    try {
      await updateDoc(doc(db, 'events', id as string, 'polls', pollId), { options: newOptions });
    } catch (error) {
      console.error('Error updating vote:', error);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'events', id as string, 'polls', pollId));
    } catch (error) {
      console.error('Error deleting poll:', error);
    }
  };

  const currentUid = auth.currentUser?.uid;
  const activePolls = polls.filter((poll) => !poll.options.some((opt: any) => opt.voterIds.includes(currentUid)));
  const answeredPolls = polls.filter((poll) => poll.options.some((opt: any) => opt.voterIds.includes(currentUid)));

  const uniqueVoters = new Set();
  polls.forEach((poll) => poll.options.forEach((opt: any) => opt.voterIds.forEach((uid: string) => uniqueVoters.add(uid))));
  const headcount = uniqueVoters.size;

  if (loading) {
    return (
      <Box className="flex-1 bg-zinc-900 justify-center items-center">
        <Text className="text-zinc-400">Loading Event...</Text>
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-zinc-900 items-center">
      <View className={`flex-1 w-full ${isMobile ? 'px-4 pt-8' : 'max-w-5xl px-6 pt-6'}`}>
        
        <EventHeader 
          eventData={eventData} 
          headcount={headcount} 
          isMobile={isMobile} 
          isOrganizer={isOrganizer} 
          joinLink={joinLink}
          onBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
          onShowQR={() => setIsQRModalOpen(true)}
          onOpenModal={openModal}
        />

        {isMobile ? (
          <>
            <HStack className="bg-zinc-800 rounded-xl p-1 mb-4 border border-zinc-700">
              {(['active', 'answered'] as const).map((tab) => (
                <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-zinc-600' : ''}`}>
                  <Text className={`text-sm font-semibold ${activeTab === tab ? 'text-zinc-50' : 'text-zinc-400'}`}>
                    {tab === 'active' ? 'Active' : 'Answered / Results'}
                  </Text>
                </TouchableOpacity>
              ))}
            </HStack>

            {isOrganizer && activeTab === 'active' && (
              <Button size="md" action="primary" className="bg-blue-600 border-0 mb-4" onPress={() => setIsModalOpen(true)}>
                <ButtonText className="font-bold text-white">+ Create Poll</ButtonText>
              </Button>
            )}

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-4 pb-12">
                {activeTab === 'active' ? (
                  activePolls.length === 0 ? (
                    <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed"><Text className="text-zinc-500">You're all caught up!</Text></Box>
                  ) : (
                    activePolls.map((poll) => <PollCard key={poll.id} poll={poll} deletable={isOrganizer} currentUid={currentUid} onVote={handleVote} onDelete={handleDeletePoll} />)
                  )
                ) : (
                  answeredPolls.length === 0 ? (
                    <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed"><Text className="text-zinc-500">No answered polls yet.</Text></Box>
                  ) : (
                    answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults deletable={isOrganizer} currentUid={currentUid} onVote={handleVote} onDelete={handleDeletePoll} />)
                  )
                )}
              </VStack>
            </ScrollView>
          </>
        ) : (
          <View className="flex-1 flex-col md:flex-row gap-8 w-full pb-6">
            <View className="flex-1">
              <HStack className="justify-between items-end mb-4 mt-1">
                <Heading size="xl" className="text-zinc-50">Active</Heading>
                {isOrganizer && (
                  <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => setIsModalOpen(true)}>
                    <ButtonText className="font-bold text-white">+ New Poll</ButtonText>
                  </Button>
                )}
              </HStack>
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <VStack className="gap-4 pb-12">
                  {activePolls.length === 0 ? (
                    <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed"><Text className="text-zinc-500">You're all caught up!</Text></Box>
                  ) : (
                    activePolls.map((poll) => <PollCard key={poll.id} poll={poll} deletable={isOrganizer} currentUid={currentUid} onVote={handleVote} onDelete={handleDeletePoll} />)
                  )}
                </VStack>
              </ScrollView>
            </View>

            <View className="flex-1">
              <Heading size="xl" className="text-zinc-50 mb-4 mt-1">Answered / Results</Heading>
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <VStack className="gap-4 pb-12">
                  {answeredPolls.length === 0 ? (
                    <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed"><Text className="text-zinc-500">No answered polls yet.</Text></Box>
                  ) : (
                    answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults deletable={isOrganizer} currentUid={currentUid} onVote={handleVote} onDelete={handleDeletePoll} />)
                  )}
                </VStack>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <QRModal visible={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} eventData={eventData} joinLink={joinLink} />
      <PollModal visible={isModalOpen} eventId={id as string} onClose={() => setIsModalOpen(false)} initialQuestion={modalConfig.question} initialChoices={modalConfig.choices} />
    </Box>
  );
}