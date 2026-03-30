import React, { useState, useEffect } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth, logAppEvent } from '@/config/firebaseConfig';
import PollModal from '@/components/custom/PollModal';
import PollCard from '@/components/custom/PollCard';
import EventHeader from '@/components/custom/EventHeader';
import QRModal from '@/components/custom/QRModal';
import EmptyState from '@/components/custom/EmptyState';
import PollActionModal from '@/components/custom/PollActionModal';
import ParticipantsModal from '@/components/custom/ParticipantsModal';
import { doc, onSnapshot, collection, query, orderBy, deleteDoc, runTransaction, updateDoc, getDocs, where} from 'firebase/firestore';
import { View, ScrollView, TouchableOpacity, useWindowDimensions, Share } from 'react-native';
import { QrCode, Share as ShareIcon, Eye } from 'lucide-react-native';



export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const toast = useToast();

  const [eventData, setEventData] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const [activeTab, setActiveTab] = useState<'details' | 'active' | 'answered'>('details');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{question?: string, choices?: string[], pollIdToEdit?: string}>({});
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [actionPoll, setActionPoll] = useState<any>(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);

  const joinLink = `https://polled.app/join?code=${eventData?.joinCode || ''}`;
  
  const openModal = (question = '', choices = ['', '']) => {
    setModalConfig({ question, choices, pollIdToEdit: undefined });
    setIsModalOpen(true);
  };

  const sendPushToEventMembers = async (title: string, body: string) => {
    try {
      // Find all users who have joined this specific event
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('joinedEvents', 'array-contains', id as string));
      const snapshot = await getDocs(q);

      const currentUid = auth.currentUser?.uid;
      const tokens: string[] = [];
      
      // Extract their push tokens
      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        // Don't send a notification to the person pressing the nudge button!
        if (docSnap.id !== currentUid && userData.expoPushToken) {
          tokens.push(userData.expoPushToken);
        }
      });

      if (tokens.length === 0) {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-amber-400 font-bold text-sm">No one to nudge!</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">None of the other users have notifications enabled.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return; 
      }

      // Send the payload to Expo's Server
      const message = {
        to: tokens, 
        sound: 'default',
        title: title,
        body: body,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

    } catch (error) {
      console.error("Error sending push notifications:", error);
    }
  };

  // --- 2. The handler function you pass to your Poll components ---
  const handleNudge = async (poll: any) => {
    await sendPushToEventMembers(
      "Don't forget to vote! ⏰", 
      `The poll "${poll.question}" is waiting for your response.`
    );
    
    toast.show({
      placement: "top",
      render: ({ id: toastId }) => (
        <Toast nativeID={toastId} className="bg-zinc-800 border border-blue-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
          <VStack>
            <ToastTitle className="text-blue-400 font-bold text-sm">Nudge Sent!</ToastTitle>
            <ToastDescription className="text-zinc-300 text-xs mt-0.5">A reminder has been sent to everyone in the event.</ToastDescription>
          </VStack>
        </Toast>
      ),
    });
  };

  const handleNativeShare = async () => {
    try {
      const result = await Share.share({
        message: `Join my event "${eventData?.title}" on Polled! Code: ${eventData?.joinCode}\n${joinLink}`,
      });

      // Show a success toast if they actually completed the share action
      if (result.action === Share.sharedAction) {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-green-400 font-bold text-sm">Shared!</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">Thanks for spreading the word about the event.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      }
      // Note: If result.action === Share.dismissedAction, we do nothing (they just closed the menu)

    } catch (error) {
      // Show an error toast if the native share sheet fails to open
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Sharing Failed</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Something went wrong trying to open the share menu.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  };

  const handleCopyCode = async () => {
    const codeToCopy = eventData?.joinCode || id;
    if (!codeToCopy) return;

    await Clipboard.setStringAsync(codeToCopy as string);
    
    toast.show({
      placement: "top",
      render: ({ id: toastId }) => (
        <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
          <VStack>
            <ToastTitle className="text-green-400 font-bold text-sm">Copied!</ToastTitle>
            <ToastDescription className="text-zinc-300 text-xs mt-0.5">Join code copied to clipboard.</ToastDescription>
          </VStack>
        </Toast>
      ),
    });
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

  const handleVote = async (pollId: string, selectedIndices: number | number[], currentOptions: any[], allowMultipleVotes: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const pollRef = doc(db, 'events', id as string, 'polls', pollId);

    try {
      await runTransaction(db, async (transaction) => {
        const pollDoc = await transaction.get(pollRef);
        if (!pollDoc.exists()) throw new Error("Poll not found");

        const pollData = pollDoc.data();

        if (pollData.expiresAt && new Date() > (pollData.expiresAt?.toDate ? pollData.expiresAt.toDate() : new Date(pollData.expiresAt))) {
          throw new Error("EXPIRED");
        }

        let newOptions = pollData.options.map((opt: any) => ({ 
          ...opt, 
          voterIds: [...opt.voterIds] 
        }));
        
        if (allowMultipleVotes && Array.isArray(selectedIndices)) {
          newOptions.forEach((opt: any) => opt.voterIds = opt.voterIds.filter((v: string) => v !== uid));
          selectedIndices.forEach((idx) => {
            if (newOptions[idx]) {
              newOptions[idx].voterIds.push(uid);
            }
          });
        } else {
          const optionIndex = selectedIndices as number;
          const hasVotedForThis = newOptions[optionIndex].voterIds.includes(uid);
          if (hasVotedForThis) {
            newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter((v: string) => v !== uid);
          } else {
            newOptions.forEach((opt: any) => opt.voterIds = opt.voterIds.filter((v: string) => v !== uid));
            newOptions[optionIndex].voterIds.push(uid);
          }
        }

        transaction.update(pollRef, { options: newOptions });
      });

      await logAppEvent('vote_cast', {
        poll_id: pollId,
        is_multiple_choice: allowMultipleVotes,
        debug_mode: true
      });
      
    } catch (error: any) {
      if (error.message === "EXPIRED") {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-red-400 font-bold text-sm">Poll Ended</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">This poll is no longer accepting votes.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      } else {
        console.error('Error updating vote:', error);
      }
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

  const handleEndPollEarly = async (poll: any) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'events', id as string, 'polls', poll.id), {
        expiresAt: new Date()
      });
    } catch (error) {
      console.error('Error ending poll early:', error);
    }
  };

  const handleEditPoll = (poll: any) => {
    setModalConfig({ 
      question: poll.question, 
      choices: poll.options.map((o: any) => o.text),
      pollIdToEdit: poll.id
    });
    setIsModalOpen(true);
  };

  const handleRerunPoll = (poll: any) => {
    setModalConfig({ 
      question: poll.question, 
      choices: poll.options.map((o: any) => o.text),
      pollIdToEdit: undefined
    });
    setIsModalOpen(true);
  };

  const currentUid = auth.currentUser?.uid;
  
  const isPollExpired = (poll: any) => {
    if (!poll.expiresAt) return false;
    const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt);
    return new Date() > expiresAtDate;
  };

  const activePolls = polls.filter((poll) => {
    const hasVoted = poll.options.some((opt: any) => opt.voterIds.includes(currentUid));
    return !hasVoted && !isPollExpired(poll);
  });
  const answeredPolls = polls.filter((poll) => {
    const hasVoted = poll.options.some((opt: any) => opt.voterIds.includes(currentUid));
    return hasVoted || isPollExpired(poll);
  });

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
      <View className={`flex-1 w-full ${isMobile ? 'px-4' : 'max-w-5xl px-6 pt-6'}`}>
        
        {/* --- DESKTOP HEADER --- */}
        {!isMobile && (
          <EventHeader 
            eventData={eventData} 
            headcount={headcount} 
            isMobile={isMobile} 
            isOrganizer={isOrganizer} 
            joinLink={joinLink}
            onBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
            onShowQR={() => setIsQRModalOpen(true)}
            onOpenModal={openModal}
            onShowParticipants={() => setIsParticipantsModalOpen(true)}
          />
        )}

        {isMobile ? (
          <>
            {/* --- NEW COMPACT MOBILE HEADER --- */}
            <VStack className="gap-4 mb-4">
              
              {/* Back Button */}
              <Button variant="link" className="self-start p-0 -ml-2" onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}>
                <ButtonText className="text-blue-500">← Dashboard</ButtonText>
              </Button>

              {/* Title & Code on One Line */}
              <HStack className="justify-between items-center gap-4">
                <Heading size="2xl" className="text-zinc-50 flex-1" numberOfLines={1}>{eventData?.title}</Heading>
                <TouchableOpacity activeOpacity={0.7} onPress={handleCopyCode}>
                  <Box className="bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                    <Text className="text-zinc-300 font-mono text-sm font-bold tracking-widest">Join Code: {eventData?.joinCode || id}</Text>
                  </Box>
                </TouchableOpacity>
              </HStack>

              {/* Share Options */}
              <HStack className="gap-3">
                <Button size="sm" variant="outline" className="flex-1 border-zinc-600 gap-2" onPress={() => setIsQRModalOpen(true)}>
                  <QrCode size={16} color="#f4f4f5" />
                  <ButtonText className="text-zinc-50 font-bold">QR Code</ButtonText>
                </Button>
                <Button size="sm" variant="outline" className="flex-1 border-zinc-600 gap-2" onPress={handleNativeShare}>
                  <ShareIcon size={16} color="#f4f4f5" />
                  <ButtonText className="text-zinc-50 font-bold">Share Link</ButtonText>
                </Button>
              </HStack>
            </VStack>

            {/* --- TABS --- */}
            <HStack className="bg-zinc-800 rounded-xl p-1 mb-4 border border-zinc-700">
              {(['details', 'active', 'answered'] as const).map((tab) => (
                <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-zinc-600' : ''}`}>
                  <Text className={`text-xs font-semibold ${activeTab === tab ? 'text-zinc-50' : 'text-zinc-400'}`}>
                    {tab === 'details' ? 'Details' : tab === 'active' ? 'Active' : 'Results'}
                  </Text>
                </TouchableOpacity>
              ))}
            </HStack>

            {/* --- CREATE BUTTON (Only on Active tab) --- */}
            {isOrganizer && activeTab === 'active' && (
              <Button size="md" action="primary" className="bg-blue-600 border-0 mb-4" onPress={() => setIsModalOpen(true)}>
                <ButtonText className="font-bold text-white">+ Create Poll</ButtonText>
              </Button>
            )}

            {/* --- TAB CONTENT --- */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-4 pb-12">
                
                {activeTab === 'details' && (
                  <VStack className="gap-4 mt-1">
                    <VStack className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-700/50 gap-4">
                      <VStack>
                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Status</Text>
                        <Text className={`text-lg font-bold ${eventData?.status === 'voting' ? 'text-green-400' : 'text-zinc-500'}`}>
                          {eventData?.status === 'voting' ? 'Active Voting' : 'Closed'}
                        </Text>
                      </VStack>
                      <View className="h-px bg-zinc-700/50 w-full" />
                      <VStack>
                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Time</Text>
                        <Text className="text-zinc-50 text-lg font-semibold">{eventData?.time || 'TBD'}</Text>
                      </VStack>
                      <View className="h-px bg-zinc-700/50 w-full" />
                      <VStack>
                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Location</Text>
                        <Text className="text-zinc-50 text-lg font-semibold">{eventData?.location || 'TBD'}</Text>
                      </VStack>
                      <View className="h-px bg-zinc-700/50 w-full" />
                      <HStack className="justify-between items-center">
                        <VStack>
                          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Active Voters</Text>
                          <Text className="text-zinc-50 text-lg font-semibold mt-0.5">{headcount} {headcount === 1 ? 'person' : 'people'}</Text>
                        </VStack>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setIsParticipantsModalOpen(true)} className="p-2 bg-zinc-700/50 rounded-full border border-zinc-600/50">
                          <Eye size={20} color="#a1a1aa" />
                        </TouchableOpacity>
                      </HStack>
                    </VStack>

                    {isOrganizer && (
                      <Button 
                        size="xl" 
                        variant="outline" 
                        className="border-zinc-600 bg-zinc-800" 
                        onPress={() => router.push(`/edit/${id as string}`)}
                      >
                        <ButtonText className="font-bold text-zinc-50">Edit Event Details</ButtonText>
                      </Button>
                    )}
                  </VStack>
                )}

                {activeTab === 'active' && (
                  activePolls.length === 0 ? (
                    <EmptyState message="You're all caught up!" />
                  ) : (
                    activePolls.map((poll) => <PollCard key={poll.id} poll={poll} isOrganizer={isOrganizer} currentUid={currentUid} onVote={handleVote} onActionPress={setActionPoll} />)
                  )
                )}

                {activeTab === 'answered' && (
                  answeredPolls.length === 0 ? (
                    <EmptyState message="No answered polls yet." />
                  ) : (
                    answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults isOrganizer={isOrganizer} currentUid={currentUid} onVote={handleVote} onActionPress={setActionPoll} />)
                  )
                )}

              </VStack>
            </ScrollView>
          </>
        ) : (
          /* --- DESKTOP VIEW --- */
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
                    <EmptyState message="You're all caught up!" />
                  ) : (
                    activePolls.map((poll) => <PollCard key={poll.id} poll={poll} isOrganizer={isOrganizer} currentUid={currentUid} onVote={handleVote} onActionPress={setActionPoll} />)
                  )}
                </VStack>
              </ScrollView>
            </View>

            <View className="flex-1">
              <Heading size="xl" className="text-zinc-50 mb-4 mt-1">Answered / Results</Heading>
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <VStack className="gap-4 pb-12">
                  {answeredPolls.length === 0 ? (
                    <EmptyState message="No answered polls yet." />
                  ) : (
                    answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults isOrganizer={isOrganizer} currentUid={currentUid} onVote={handleVote} onActionPress={setActionPoll} />)
                  )}
                </VStack>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <QRModal visible={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} eventData={eventData} joinLink={joinLink} />
      <PollModal visible={isModalOpen} eventId={id as string} onClose={() => setIsModalOpen(false)} initialQuestion={modalConfig.question} initialChoices={modalConfig.choices} pollIdToEdit={modalConfig.pollIdToEdit} />
      <PollActionModal 
        isOpen={!!actionPoll} 
        poll={actionPoll} 
        onClose={() => setActionPoll(null)} 
        onDelete={(poll: any) => handleDeletePoll(poll.id)}
        onEndEarly={handleEndPollEarly}
        onEdit={handleEditPoll}
        onRerun={handleRerunPoll}
        onNudge={handleNudge}
      />
      <ParticipantsModal visible={isParticipantsModalOpen} onClose={() => setIsParticipantsModalOpen(false)} voterIds={Array.from(uniqueVoters) as string[]} />
    </Box>
  );
}