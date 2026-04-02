import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from '@/config/firebaseConfig';
import PollModal from '@/components/custom/PollModal';
import PollCard from '@/components/custom/PollCard';
import EventHeader from '@/components/custom/EventHeader';
import QRModal from '@/components/custom/QRModal';
import EmptyState from '@/components/custom/EmptyState';
import PollActionModal from '@/components/custom/PollActionModal';
import ParticipantsModal from '@/components/custom/ParticipantsModal';
import { buildJoinLink } from '@/utils/inviteLinks';
import { trackEvent } from '@/utils/analytics';
import { getEventItemType, getRespondedUserIds, getResponseCount, isEventItemExpired } from '@/utils/eventItems';
import { doc, onSnapshot, collection, query, orderBy, deleteDoc, runTransaction, updateDoc, getDocs, where, getDoc } from 'firebase/firestore';
import { View, ScrollView, TouchableOpacity, useWindowDimensions, Share } from 'react-native';
import { QrCode, Share as ShareIcon, Eye } from 'lucide-react-native';

type LinkedField = 'time' | 'location';


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
  const [modalConfig, setModalConfig] = useState<{question?: string, choices?: string[], pollIdToEdit?: string, linkedField?: LinkedField}>({});
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [actionPoll, setActionPoll] = useState<any>(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const quickPollSyncingRef = useRef<Record<LinkedField, string | null>>({ time: null, location: null });
  const [hasAccess, setHasAccess] = useState(false);

  const joinLink = buildJoinLink(eventData?.joinCode);
  
  const openModal = (question = '', choices = ['', ''], linkedField?: LinkedField) => {
    setModalConfig({ question, choices, pollIdToEdit: undefined, linkedField });
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
    const itemType = getEventItemType(poll);
    await sendPushToEventMembers(
      itemType === 'role' ? 'Role still open!' : "Don't forget to vote! ⏰",
      itemType === 'role'
        ? `The role "${poll.question}" is still available to claim.`
        : `The poll "${poll.question}" is waiting for your response.`
    );
    trackEvent(itemType === 'role' ? 'role_nudged' : 'poll_nudged', { event_id: id as string, poll_id: poll.id });

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
        trackEvent('event_shared', {
          event_id: id as string,
          method: 'native_share',
        });
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
    trackEvent('event_code_copied', { event_id: id as string });
    
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

    let unsubscribeEvent: (() => void) | undefined;
    let unsubscribePolls: (() => void) | undefined;

    const initializeEventAccess = async () => {
      try {
        const eventRef = doc(db, 'events', id as string);
        const eventDoc = await getDoc(eventRef);

        if (!eventDoc.exists()) {
          setLoading(false);
          router.replace('/dashboard');
          return;
        }

        const event = eventDoc.data();
        const currentUid = auth.currentUser?.uid;
        const userDoc = currentUid ? await getDoc(doc(db, 'users', currentUid)) : null;
        const joinedEvents = userDoc?.exists() ? (userDoc.data().joinedEvents || []) : [];
        const userHasAccess = event.organizerId === currentUid || joinedEvents.includes(id as string);

        if (!userHasAccess) {
          trackEvent('event_access_redirected_to_join', {
            event_id: id as string,
            join_code_present: !!event.joinCode,
          });
          setLoading(false);
          router.replace(event.joinCode ? `/join?code=${event.joinCode}` : '/join');
          return;
        }

        setHasAccess(true);

        unsubscribeEvent = onSnapshot(eventRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setEventData(data);
            setIsOrganizer(data.organizerId === auth.currentUser?.uid);
          }
          setLoading(false);
        });

        const pollsRef = collection(db, 'events', id as string, 'polls');
        const q = query(pollsRef, orderBy('createdAt', 'desc'));
        unsubscribePolls = onSnapshot(q, (snapshot) => {
          setPolls(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
      } catch (error) {
        console.error('Error checking event access:', error);
        setLoading(false);
        router.replace('/dashboard');
      }
    };

    initializeEventAccess();

    return () => {
      if (unsubscribeEvent) unsubscribeEvent();
      if (unsubscribePolls) unsubscribePolls();
    };
  }, [id, router]);

  const getLinkedQuickPoll = (field: LinkedField) =>
    polls.find((poll) => getEventItemType(poll) === 'poll' && poll.linkedField === field);

  const getWinningOption = (poll: any) => {
    if (!poll?.options?.length) return null;
    const maxVotes = Math.max(...poll.options.map((option: any) => option.voterIds.length));
    if (maxVotes <= 0) return null;
    const winners = poll.options.filter((option: any) => option.voterIds.length === maxVotes);
    return winners.length === 1 ? winners[0] : null;
  };

  useEffect(() => {
    if (!id || !eventData || !hasAccess) return;

    const syncQuickPollDetails = async () => {
      const eventRef = doc(db, 'events', id as string);

      for (const field of ['time', 'location'] as LinkedField[]) {
        const linkedQuickPoll = getLinkedQuickPoll(field);
        if (!linkedQuickPoll || !isPollExpired(linkedQuickPoll)) continue;

        const winningOption = getWinningOption(linkedQuickPoll);
        if (!winningOption?.text?.trim()) continue;

        const winningValue = winningOption.text.trim();
        const currentValue = eventData?.[field]?.trim() || '';

        if (currentValue === winningValue) {
          quickPollSyncingRef.current[field] = linkedQuickPoll.id;
          continue;
        }

        if (quickPollSyncingRef.current[field] === linkedQuickPoll.id) continue;
        quickPollSyncingRef.current[field] = linkedQuickPoll.id;

        try {
          await updateDoc(eventRef, {
            [field]: winningValue,
          });
          trackEvent('quick_poll_result_applied', {
            event_id: id as string,
            field,
            poll_id: linkedQuickPoll.id,
          });
        } catch (error) {
          quickPollSyncingRef.current[field] = null;
          console.error(`Error syncing ${field} quick poll result:`, error);
        }
      }
    };

    syncQuickPollDetails();
  }, [id, eventData, polls, hasAccess]);

  const handleVote = async (pollId: string, selectedIndices: number | number[], currentOptions: any[], allowMultipleVotes: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const pollRef = doc(db, 'events', id as string, 'polls', pollId);
    let updatedItemType: 'poll' | 'role' = 'poll';
    let roleAction: 'claimed' | 'unclaimed' | null = null;

    try {
      await runTransaction(db, async (transaction) => {
        const pollDoc = await transaction.get(pollRef);
        if (!pollDoc.exists()) throw new Error("Poll not found");

        const pollData = pollDoc.data();
        updatedItemType = getEventItemType(pollData);

        if (updatedItemType === 'role') {
          const roleOption = pollData.options?.[0];
          const roleIsFull = pollData.slotLimit != null && getResponseCount(pollData) >= pollData.slotLimit;
          const alreadySelected = roleOption?.voterIds?.includes(uid);
          roleAction = alreadySelected ? 'unclaimed' : 'claimed';

          if (roleIsFull && !alreadySelected) {
            throw new Error('FULL');
          }
        } else if (isEventItemExpired(pollData)) {
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
      trackEvent(roleAction
        ? (roleAction === 'unclaimed' ? 'role_unclaimed' : 'role_claimed')
        : 'poll_voted', {
        event_id: id as string,
        poll_id: pollId,
        allow_multiple: allowMultipleVotes,
        selection_count: Array.isArray(selectedIndices) ? selectedIndices.length : 1,
      });
      
    } catch (error: any) {
      if (error.message === 'FULL') {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-12 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-amber-400 font-bold text-sm">Role Filled</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">All available spots for that role have already been claimed.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      } else if (error.message === "EXPIRED") {
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

  const handleDeletePoll = async (poll: any) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'events', id as string, 'polls', poll.id));
      trackEvent(getEventItemType(poll) === 'role' ? 'role_deleted' : 'poll_deleted', {
        event_id: id as string,
        poll_id: poll.id,
      });
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
      trackEvent('poll_ended_early', { event_id: id as string, poll_id: poll.id });
    } catch (error) {
      console.error('Error ending poll early:', error);
    }
  };

  const handleEditPoll = (poll: any) => {
    trackEvent(getEventItemType(poll) === 'role' ? 'role_edit_started' : 'poll_edit_started', { event_id: id as string, poll_id: poll.id });
    setModalConfig({ 
      question: poll.question, 
      choices: poll.options.map((o: any) => o.text),
      pollIdToEdit: poll.id,
      linkedField: poll.linkedField,
    });
    setIsModalOpen(true);
  };

  const handleRerunPoll = (poll: any) => {
    if (getEventItemType(poll) === 'role') return;
    trackEvent('poll_rerun_started', { event_id: id as string, poll_id: poll.id });
    setModalConfig({ 
      question: poll.question, 
      choices: poll.options.map((o: any) => o.text),
      pollIdToEdit: undefined,
      linkedField: poll.linkedField,
    });
    setIsModalOpen(true);
  };

  const currentUid = auth.currentUser?.uid;
  
  const isPollExpired = (poll: any) => {
    return isEventItemExpired(poll);
  };

  const activePolls = polls.filter((poll) => {
    const respondedUserIds = getRespondedUserIds(poll);
    const hasVoted = currentUid ? respondedUserIds.includes(currentUid) : false;
    return !hasVoted && !isPollExpired(poll);
  });
  const answeredPolls = polls.filter((poll) => {
    const respondedUserIds = getRespondedUserIds(poll);
    const hasVoted = currentUid ? respondedUserIds.includes(currentUid) : false;
    return hasVoted || isPollExpired(poll);
  });

  const uniqueParticipants = new Set<string>();
  const roleAssignments = polls.reduce<Record<string, string[]>>((acc, poll) => {
    getRespondedUserIds(poll).forEach((uid) => uniqueParticipants.add(uid));

    if (getEventItemType(poll) === 'role') {
      getRespondedUserIds(poll).forEach((uid) => {
        acc[uid] = [...(acc[uid] || []), poll.question];
      });
    }

    return acc;
  }, {});
  const headcount = uniqueParticipants.size;
  const timeQuickPoll = getLinkedQuickPoll('time');
  const locationQuickPoll = getLinkedQuickPoll('location');

  const renderDetailValue = (field: LinkedField) => {
    const currentValue = eventData?.[field];
    if (currentValue) {
      return <Text className="text-zinc-50 text-lg font-semibold">{currentValue}</Text>;
    }

    if (!isOrganizer) {
      return <Text className="text-zinc-50 text-lg font-semibold">TBD</Text>;
    }

    const linkedQuickPoll = field === 'time' ? timeQuickPoll : locationQuickPoll;
    const defaultQuestion = field === 'time' ? 'What time?' : 'Where we going?';
    const defaultButtonLabel = field === 'time' ? 'Poll Time' : 'Poll Location';

    if (linkedQuickPoll && !isPollExpired(linkedQuickPoll)) {
      return (
        <Text className="text-blue-400 text-base font-semibold">
          Currently polling
        </Text>
      );
    }

    if (linkedQuickPoll && isPollExpired(linkedQuickPoll) && !getWinningOption(linkedQuickPoll)) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="self-start border-zinc-600 bg-zinc-800 mt-2"
          onPress={() => openModal(defaultQuestion, ['', ''], field)}
        >
          <ButtonText className="text-zinc-50 font-semibold">Rerun Poll</ButtonText>
        </Button>
      );
    }

    if (linkedQuickPoll && isPollExpired(linkedQuickPoll) && getWinningOption(linkedQuickPoll)) {
      return <Text className="text-blue-400 text-base font-semibold">Updating from quick poll...</Text>;
    }

    return (
      <Button
        size="sm"
        variant="outline"
        className="self-start border-zinc-600 bg-zinc-800 mt-2"
        onPress={() => openModal(defaultQuestion, ['', ''], field)}
      >
        <ButtonText className="text-zinc-50 font-semibold">{defaultButtonLabel}</ButtonText>
      </Button>
    );
  };

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
            timeQuickPoll={timeQuickPoll}
            locationQuickPoll={locationQuickPoll}
            isQuickPollExpired={isPollExpired}
            getQuickPollWinner={getWinningOption}
            onBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
            onShowQR={() => {
              trackEvent('qr_modal_opened', { event_id: id as string });
              setIsQRModalOpen(true);
            }}
            onOpenModal={(question, linkedField) => openModal(question, ['', ''], linkedField)}
            onShowParticipants={() => {
              trackEvent('participants_modal_opened', { event_id: id as string });
              setIsParticipantsModalOpen(true);
            }}
            onEditEvent={() => {
              trackEvent('event_edit_started', { event_id: id as string });
              router.push(`/edit/${id as string}`);
            }}
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
                <Button size="sm" variant="outline" className="flex-1 border-zinc-600 gap-2" onPress={() => {
                  trackEvent('qr_modal_opened', { event_id: id as string });
                  setIsQRModalOpen(true);
                }}>
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
              <Button size="md" action="primary" className="bg-blue-600 border-0 mb-4" onPress={() => {
                trackEvent('item_create_started', { event_id: id as string });
                setIsModalOpen(true);
              }}>
                <ButtonText className="font-bold text-white">+ Create</ButtonText>
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
                        {renderDetailValue('time')}
                      </VStack>
                      <View className="h-px bg-zinc-700/50 w-full" />
                      <VStack>
                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Location</Text>
                        {renderDetailValue('location')}
                      </VStack>
                      <View className="h-px bg-zinc-700/50 w-full" />
                      <HStack className="justify-between items-center">
                        <VStack>
                          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Participants</Text>
                          <Text className="text-zinc-50 text-lg font-semibold mt-0.5">{headcount} {headcount === 1 ? 'person' : 'people'}</Text>
                        </VStack>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => {
                          trackEvent('participants_modal_opened', { event_id: id as string });
                          setIsParticipantsModalOpen(true);
                        }} className="p-2 bg-zinc-700/50 rounded-full border border-zinc-600/50">
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
                  <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => {
                    trackEvent('item_create_started', { event_id: id as string });
                    setIsModalOpen(true);
                  }}>
                    <ButtonText className="font-bold text-white">+ New</ButtonText>
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
      <PollModal visible={isModalOpen} eventId={id as string} onClose={() => setIsModalOpen(false)} initialQuestion={modalConfig.question} initialChoices={modalConfig.choices} pollIdToEdit={modalConfig.pollIdToEdit} linkedField={modalConfig.linkedField} />
      <PollActionModal 
        isOpen={!!actionPoll} 
        poll={actionPoll} 
        onClose={() => setActionPoll(null)} 
        onDelete={handleDeletePoll}
        onEndEarly={handleEndPollEarly}
        onEdit={handleEditPoll}
        onRerun={handleRerunPoll}
        onNudge={handleNudge}
      />
      <ParticipantsModal
        visible={isParticipantsModalOpen}
        onClose={() => setIsParticipantsModalOpen(false)}
        participantIds={Array.from(uniqueParticipants)}
        roleAssignments={roleAssignments}
        organizerId={eventData?.organizerId}
        eventId={id as string}
      />
    </Box>
  );
}
