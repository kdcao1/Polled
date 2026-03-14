import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';
import { Pressable } from 'react-native';

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  // Event Data State
  const [eventData, setEventData] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Modal State (Creator Only)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState(['', '']); // Start with 2 empty choices
  const [allowMultiple, setAllowMultiple] = useState(false);

  // Real-time listener for the event
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

  // Real-time listener for the Polls subcollection
  useEffect(() => {
    if (!id) return;

    // Point to the specific event's polls subcollection
    const pollsRef = collection(db, 'events', id as string, 'polls');
    
    // Order them so the newest polls show up at the top
    const q = query(pollsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPolls = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPolls(fetchedPolls);
    });

    return () => unsubscribe(); // Cleanup listener when leaving screen
  }, [id]);

  const handleVote = async (pollId: string, optionIndex: number, currentOptions: any[], allowMultiple: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 1. Create a fresh copy of the options array to modify
    const newOptions = currentOptions.map(opt => ({
      ...opt,
      voterIds: [...opt.voterIds] // Deep copy the arrays
    }));

    const hasVotedForThis = newOptions[optionIndex].voterIds.includes(uid);

    if (allowMultiple) {
      // MULTIPLE CHOICE: Just toggle this specific option on or off
      if (hasVotedForThis) {
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter((id: string) => id !== uid);
      } else {
        newOptions[optionIndex].voterIds.push(uid);
      }
    } else {
      // SINGLE CHOICE: Remove their vote from all other options first
      if (hasVotedForThis) {
        // If they tap their existing vote, just remove it (un-vote)
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter((id: string) => id !== uid);
      } else {
        // Wipe their UID from all options
        newOptions.forEach(opt => {
          opt.voterIds = opt.voterIds.filter((id: string) => id !== uid);
        });
        // Add their UID to the new option they just tapped
        newOptions[optionIndex].voterIds.push(uid);
      }
    }

    // 2. Push the updated options array back to Firestore
    try {
      const pollRef = doc(db, 'events', id as string, 'polls', pollId);
      await updateDoc(pollRef, { options: newOptions });
    } catch (error) {
      console.error("Error updating vote:", error);
    }
  };

  // Modal Handlers
  const handleAddChoice = () => setChoices([...choices, '']);
  const handleUpdateChoice = (text: string, index: number) => {
    const newChoices = [...choices];
    newChoices[index] = text;
    setChoices(newChoices);
  };

  const handleCreatePoll = async () => {
    // 1. Double check we have valid data before talking to the database
    if (!question.trim() || choices.some(c => !c.trim()) || !id) return;

    try {
      // 2. Point directly to the "polls" subcollection inside this specific event
      const pollsRef = collection(db, 'events', id as string, 'polls');

      // 3. Format the choices so they can hold votes later
      // We turn the array of strings ["Monday", "Tuesday"] into objects so we can attach users to them!
      const formattedOptions = choices.map(choice => ({
        text: choice.trim(),
        voterIds: [] // We will push user UIDs into this array when they vote!
      }));

      // 4. Push the new poll to Firestore
      await addDoc(pollsRef, {
        question: question.trim(),
        allowMultiple: allowMultiple,
        options: formattedOptions,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      // 5. Close the modal and wipe the form clean for the next one
      setIsModalOpen(false);
      handleClearForm();

    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Something went wrong saving your poll. Try again.");
    }
  };

  const handleClearForm = () => {
    setQuestion('');
    setChoices(['', '']);
    setAllowMultiple(false);
  };

  const currentUid = auth.currentUser?.uid;

  const activePolls = polls.filter(poll => 
    !poll.options.some((opt: any) => opt.voterIds.includes(currentUid))
  );

  const answeredPolls = polls.filter(poll => 
    poll.options.some((opt: any) => opt.voterIds.includes(currentUid))
  );

  if (loading) {
    return <Box className="flex-1 bg-zinc-900 justify-center items-center"><Text className="text-zinc-400">Loading Event...</Text></Box>;
  }

  return (
    <Box className="flex-1 bg-zinc-900 items-center">
      
      {/* 1. REPLACED SCROLLVIEW WITH A STANDARD VIEW: This locks the page in place */}
      <View className="w-full max-w-5xl flex-1 px-6 pt-6">
        
        {/* --- TOP ROW: HEADER & SUMMARY (Now permanently pinned to the top) --- */}
        <VStack className="gap-2 mb-6">
          <Button variant="link" onPress={() => router.replace('/dashboard')} className="self-start p-0 mb-2">
            <ButtonText className="text-blue-500">← Back</ButtonText>
          </Button>
          
          <HStack className="justify-between items-start w-full flex-wrap gap-4">
            <VStack>
              <Heading size="3xl" className="text-zinc-50">{eventData?.title}</Heading>
              <HStack className="items-center gap-2 mt-2">
                <Text className="text-zinc-400 text-lg">Join Code:</Text>
                <Box className="bg-zinc-800 px-3 py-1 rounded-md border border-zinc-700">
                  <Text className="text-zinc-50 font-mono font-bold tracking-widest">{eventData?.joinCode}</Text>
                </Box>
              </HStack>
            </VStack>

            <VStack className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700 min-w-[250px] flex-1 max-w-sm">
              <Heading size="sm" className="text-zinc-400 uppercase tracking-wider mb-2">Event Details</Heading>
              <VStack className="gap-2">
                <HStack className="justify-between">
                  <Text className="text-zinc-400">Status</Text>
                  <Text className="text-green-400 font-bold">Planning</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-zinc-400">Location</Text>
                  <Text className="text-zinc-50 font-semibold">TBD</Text>
                </HStack>
                <HStack className="justify-between">
                  <Text className="text-zinc-400">Time</Text>
                  <Text className="text-zinc-50 font-semibold">TBD</Text>
                </HStack>
              </VStack>
            </VStack>
          </HStack>
        </VStack>

        {/* --- 2. THE GRID CONTAINER --- */}
        {/* Added flex-1 here so the columns stretch all the way to the bottom of the screen */}
        <View className="flex-1 flex-col md:flex-row gap-8 w-full pb-6">
          
          {/* LEFT COLUMN: ACTIVE POLLS */}
          <View className="flex-1">
            <HStack className="justify-between items-end mb-4 mt-1">
              <Heading size="xl" className="text-zinc-50">Active Polls</Heading>
              {isOrganizer && (
                <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => setIsModalOpen(true)}>
                  <ButtonText className="font-bold text-white">+ New Poll</ButtonText>
                </Button>
              )}
            </HStack>
            
            {/* 3. INDEPENDENT SCROLLER FOR ACTIVE POLLS */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-4 pb-12">
                {activePolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">You're all caught up!</Text>
                  </Box>
                ) : (
                  activePolls.map((poll) => (
                    <VStack key={poll.id} className="bg-zinc-800 rounded-xl p-5 border border-zinc-700 gap-4">
                      <VStack className="gap-1">
                        <Text className="text-zinc-50 font-bold text-xl">{poll.question}</Text>
                        {poll.allowMultiple && (
                          <Text className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Select Multiple</Text>
                        )}
                      </VStack>

                      <VStack className="gap-2 mt-2">
                        {poll.options.map((option: any, index: number) => {
                          const hasVoted = option.voterIds.includes(currentUid);
                          const voteCount = option.voterIds.length;

                          return (
                            <TouchableOpacity 
                              key={index} 
                              activeOpacity={0.7}
                              onPress={() => handleVote(poll.id, index, poll.options, poll.allowMultiple)}
                              className={`p-4 rounded-lg border ${hasVoted ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
                            >
                              <HStack className="justify-between items-center">
                                <Text className={`font-medium ${hasVoted ? 'text-blue-100' : 'text-zinc-300'}`}>{option.text}</Text>
                                <Text className={`text-sm font-bold ${hasVoted ? 'text-blue-400' : 'text-zinc-500'}`}>
                                  {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                                </Text>
                              </HStack>
                            </TouchableOpacity>
                          );
                        })}
                      </VStack>
                    </VStack>
                  ))
                )}
              </VStack>
            </ScrollView>
          </View>

          {/* RIGHT COLUMN: ANSWERED POLLS */}
          <View className="flex-1">
            <Heading size="xl" className="text-zinc-50 mb-4 mt-1">Answered</Heading>
            
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-3 pb-12">
                {answeredPolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">No answered polls yet.</Text>
                  </Box>
                ) : (
                  answeredPolls.map((poll) => (
                    // 1. Reduced outer padding to p-4 and gap to gap-2
                    <VStack key={poll.id} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 gap-2 opacity-75">
                      
                      <VStack className="gap-0.5">
                        {/* 2. Shrunk the question text from text-xl to text-lg */}
                        <Text className="text-zinc-50 font-bold text-lg leading-tight">{poll.question}</Text>
                        {poll.allowMultiple && (
                          <Text className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider">Select Multiple</Text>
                        )}
                      </VStack>

                      <VStack className="gap-1.5 mt-1">
                        {poll.options.map((option: any, index: number) => {
                          const hasVoted = option.voterIds.includes(currentUid);
                          const voteCount = option.voterIds.length;

                          return (
                            <TouchableOpacity 
                              key={index} 
                              activeOpacity={0.7}
                              onPress={() => handleVote(poll.id, index, poll.options, poll.allowMultiple)}
                              // 3. Shrunk the button padding to p-3
                              className={`p-3 rounded-lg border ${hasVoted ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
                            >
                              <HStack className="justify-between items-center">
                                {/* 4. Made the option text slightly smaller */}
                                <Text className={`font-medium text-sm ${hasVoted ? 'text-blue-100' : 'text-zinc-300'}`}>{option.text}</Text>
                                <Text className={`text-xs font-bold ${hasVoted ? 'text-blue-400' : 'text-zinc-500'}`}>
                                  {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                                </Text>
                              </HStack>
                            </TouchableOpacity>
                          );
                        })}
                      </VStack>
                    </VStack>
                  ))
                )}
              </VStack>
            </ScrollView>
          </View>

        </View>
      </View>

      {/* --- 5. CREATOR MODAL --- */}
      <Modal visible={isModalOpen} animationType="fade" transparent={true}>
        {/* ... (Your exact same Modal code goes here, completely untouched) ... */}
      </Modal>

    </Box>
  );
}