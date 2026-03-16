import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Pressable,
  Share,
  Platform,
} from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

// ---------------------------------------------------------------------------
// PollModal — Cleaned up to no longer require initial templates
// ---------------------------------------------------------------------------
interface PollModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  initialQuestion?: string;
  initialChoices?: string[];
}

function PollModal({ 
  visible, 
  eventId, 
  onClose, 
  initialQuestion, 
  initialChoices 
}: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  
  // Add this new state for the custom dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // No longer allows null; defaults to 24 hours
  const [durationHours, setDurationHours] = useState<number>(24);

  const DURATION_OPTIONS = [
    { label: '1 Hour', value: 1 },
    { label: '2 Hours', value: 2 },
    { label: '6 Hours', value: 6 },
    { label: '12 Hours', value: 12 },
    { label: '1 Day', value: 24 },
    { label: '2 Days', value: 48 },
    { label: '3 Days', value: 72 },
    { label: '1 Week', value: 168 },
  ];

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
      setChoices(initialChoices && initialChoices.length > 0 ? initialChoices : ['', '']);
      setAllowMultiple(false);
      setIsDropdownOpen(false);
      setDurationHours(24);
    }
  }, [initialQuestion, initialChoices]);

  const handleClearForm = () => {
    setQuestion('');
    setChoices(['', '']);
    setAllowMultiple(false);
    setDurationHours(24);
    setIsDropdownOpen(false);
  };

  const handleAddChoice = () => setChoices([...choices, '']);

  const handleUpdateChoice = (text: string, index: number) => {
    const updated = [...choices];
    updated[index] = text;
    setChoices(updated);
  };

  const handleCreatePoll = async () => {
    if (!question.trim() || choices.some((c) => !c.trim())) return;
    try {
      const pollsRef = collection(db, 'events', eventId, 'polls');
      
      // Calculate the exact expiration Date object
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      await addDoc(pollsRef, {
        question: question.trim(),
        allowMultiple,
        options: choices.map((c) => ({ text: c.trim(), voterIds: [] })),
        createdAt: serverTimestamp(),
        status: 'active',
        expiresAt: expiresAt,
      });
      
      handleClearForm(); 
      onClose();
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Something went wrong saving your poll. Try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable
          className="absolute top-0 bottom-0 left-0 right-0 bg-black/80"
          onPress={onClose}
        />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-md max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-6">
            <Heading size="xl" className="text-zinc-50">Create a Poll</Heading>
            <HStack className="gap-2">
              <Button size="sm" variant="link" onPress={handleClearForm}>
                <ButtonText className="text-red-400 font-semibold">Clear</ButtonText>
              </Button>
              <Button size="sm" variant="link" onPress={onClose}>
                <ButtonText className="text-zinc-400">Cancel</ButtonText>
              </Button>
            </HStack>
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack className="gap-6 pb-2">
              <VStack className="gap-2">
                <Text className="text-zinc-300 font-bold ml-1">Main Question</Text>
                <Input variant="outline" size="xl" className="border-zinc-700">
                  <InputField
                    placeholder="e.g., What day works best?"
                    placeholderTextColor="#a1a1aa"
                    className="text-zinc-50"
                    value={question}
                    onChangeText={setQuestion}
                  />
                </Input>
              </VStack>

              <HStack className="justify-between items-center bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                <Text className="text-zinc-50 font-bold">Allow Multiple Choices</Text>
                <Switch
                  value={allowMultiple}
                  onValueChange={setAllowMultiple}
                  trackColor={{ false: '#3f3f46', true: '#2563eb' }}
                />
              </HStack>

              {/* Poll Duration Dropdown */}
              <VStack className="gap-2 mt-2">
                <Text className="text-zinc-300 font-bold ml-1">Poll Duration</Text>
                
                <TouchableOpacity 
                  activeOpacity={0.7}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center"
                  onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <Text className="text-zinc-50 font-medium text-base">
                    {DURATION_OPTIONS.find(opt => opt.value === durationHours)?.label}
                  </Text>
                  <Text className="text-zinc-400 text-xs">
                    {isDropdownOpen ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {/* Dropdown Menu Items */}
                {Platform.OS === 'web' && isDropdownOpen && (
                  <View className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden mt-1 max-h-48">
                    <ScrollView nestedScrollEnabled={true}>
                      {DURATION_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          className={`p-4 border-b border-zinc-700/50 ${durationHours === option.value ? 'bg-zinc-700' : ''}`}
                          onPress={() => {
                            setDurationHours(option.value);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <Text className={`font-medium ${durationHours === option.value ? 'text-blue-400' : 'text-zinc-300'}`}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </VStack>

              <VStack className="gap-3">
                <Text className="text-zinc-300 font-bold ml-1">Choices</Text>
                {choices.map((choice, index) => (
                  <Input key={index} variant="outline" size="xl" className="border-zinc-700">
                    <InputField
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor="#52525b"
                      className="text-zinc-50"
                      value={choice}
                      onChangeText={(text) => handleUpdateChoice(text, index)}
                    />
                  </Input>
                ))}
                <Button
                  variant="outline"
                  action="secondary"
                  className="border-zinc-700 border-dashed mt-2"
                  onPress={handleAddChoice}
                >
                  <ButtonText className="text-zinc-400 font-bold">+ Add Another Option</ButtonText>
                </Button>
              </VStack>

              <Button
                size="xl"
                action="primary"
                className="bg-blue-600 border-0 mt-4 mb-4"
                onPress={handleCreatePoll}
                isDisabled={!question.trim() || choices.some((c) => !c.trim())}
              >
                <ButtonText className="font-bold text-white">Publish Poll</ButtonText>
              </Button>
            </VStack>
          </ScrollView>
        </View>

        {/* --- REFINED NATIVE-STYLE BOTTOM SHEET OVERLAY --- */}
        {Platform.OS !== 'web' && isDropdownOpen && (
          <View className="absolute top-0 bottom-0 left-0 right-0 justify-end z-50">
            {/* Dark background click-to-close */}
            <Pressable 
              className="absolute top-0 bottom-0 left-0 right-0 bg-black/70" 
              onPress={() => setIsDropdownOpen(false)} 
            />
            
            {/* Bottom Sheet Container */}
            <View className="bg-[#1c1c1e] rounded-t-[32px] pt-3 pb-10 px-4 shadow-2xl w-full max-w-md self-center">
              
              {/* Drag Handle */}
              <View className="w-10 h-1.5 bg-zinc-600 rounded-full self-center mb-6" />
              
              <Text className="text-zinc-300 font-bold text-sm mb-3 ml-2 tracking-wide">
                Poll Duration
              </Text>
              
              {/* Encapsulated List Group */}
              <View className="bg-zinc-800 rounded-2xl overflow-hidden">
                <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                  {DURATION_OPTIONS.map((option, index) => {
                    const isSelected = durationHours === option.value;
                    const isLast = index === DURATION_OPTIONS.length - 1;
                    
                    return (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.7}
                        className={`flex-row justify-between items-center p-5 ${!isLast ? 'border-b border-zinc-700/50' : ''}`}
                        onPress={() => {
                          setDurationHours(option.value);
                          // A tiny delay lets the user see the radio button fill before closing!
                          setTimeout(() => setIsDropdownOpen(false), 200); 
                        }}
                      >
                        <Text className={`text-base ${isSelected ? 'text-zinc-50 font-medium' : 'text-zinc-300'}`}>
                          {option.label}
                        </Text>
                        
                        {/* Custom Radio Button */}
                        <View 
                          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                            isSelected ? 'border-indigo-500' : 'border-zinc-500'
                          }`}
                        >
                          {isSelected && (
                            <View className="w-3 h-3 rounded-full bg-indigo-500" />
                          )}
                        </View>
                        
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        )}
      </View>

    </Modal>
  );
}

const formatTimeLeft = (expirationDate: Date) => {
  const diffMs = expirationDate.getTime() - new Date().getTime();
  if (diffMs <= 0) return 'Ended';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(diffMins / (60 * 24));
  const hours = Math.floor((diffMins % (60 * 24)) / 60);
  const minutes = diffMins % 60;

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Ends in ${minutes}m`;
  return 'Ends in < 1m';
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [eventData, setEventData] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Mobile tab: 'active' | 'answered'
  const [activeTab, setActiveTab] = useState<'active' | 'answered'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{question?: string, choices?: string[]}>({});

  const openModal = (question = '', choices = ['', '']) => {
    setModalConfig({ question, choices });
    setIsModalOpen(true);
  };

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Construct the join link (adjust the domain to match your actual routing)
  const joinLink = eventData?.joinCode 
    ? `https://polled.app/join/${eventData.joinCode}` 
    : `https://polled.app/join/${id}`;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(joinLink);
    alert('Join link copied to clipboard!'); 
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my event "${eventData?.title}" on Polled!\nCode: ${eventData?.joinCode}\n${joinLink}`,
      });
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  // Real-time listener — event doc
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

  // Real-time listener — polls subcollection
  useEffect(() => {
    if (!id) return;
    const pollsRef = collection(db, 'events', id as string, 'polls');
    const q = query(pollsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPolls(fetched);
    });
    return () => unsubscribe();
  }, [id]);

  // Vote handler
  const handleVote = async (pollId: string, optionIndex: number, currentOptions: any[], allowMultipleVotes: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const poll = polls.find(p => p.id === pollId);
    if (poll?.expiresAt) {
      const expirationDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt);
      if (new Date() > expirationDate) {
        alert('This poll has ended.');
        return;
      }
    }

    const newOptions = currentOptions.map((opt) => ({
      ...opt,
      voterIds: [...opt.voterIds],
    }));

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
        newOptions.forEach((opt) => {
          opt.voterIds = opt.voterIds.filter((v: string) => v !== uid);
        });
        newOptions[optionIndex].voterIds.push(uid);
      }
    }

    try {
      const pollRef = doc(db, 'events', id as string, 'polls', pollId);
      await updateDoc(pollRef, { options: newOptions });
    } catch (error) {
      console.error('Error updating vote:', error);
    }
  };

  // Delete a poll (organizer only)
  const handleDeletePoll = async (pollId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'events', id as string, 'polls', pollId));
    } catch (error) {
      console.error('Error deleting poll:', error);
    }
  };

  const currentUid = auth.currentUser?.uid;
  const activePolls = polls.filter(
    (poll) => !poll.options.some((opt: any) => opt.voterIds.includes(currentUid))
  );
  const answeredPolls = polls.filter((poll) =>
    poll.options.some((opt: any) => opt.voterIds.includes(currentUid))
  );

  if (loading) {
    return (
      <Box className="flex-1 bg-zinc-900 justify-center items-center">
        <Text className="text-zinc-400">Loading Event...</Text>
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Unified Poll Card (Displays Results visually if showResults=true)
  // -------------------------------------------------------------------------
  const PollCard = ({ poll, compact = false, deletable = false, showResults = false }: { poll: any; compact?: boolean; deletable?: boolean; showResults?: boolean; }) => {
    const totalVotes = poll.options.reduce((s: number, o: any) => s + o.voterIds.length, 0);

    // Extract expiration date safely
    const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
    
    // Set up local state for the live timer
    const [isExpired, setIsExpired] = useState(() => expiresAtDate ? new Date() > expiresAtDate : false);
    const [timeLeft, setTimeLeft] = useState(() => expiresAtDate && !isExpired ? formatTimeLeft(expiresAtDate) : '');

    // Live countdown effect: updates every 60 seconds
    useEffect(() => {
      if (!expiresAtDate || isExpired) return;

      const interval = setInterval(() => {
        if (new Date() > expiresAtDate) {
          setIsExpired(true);
          clearInterval(interval);
        } else {
          setTimeLeft(formatTimeLeft(expiresAtDate));
        }
      }, 60000); // 60,000ms = 1 minute

      return () => clearInterval(interval);
    }, [expiresAtDate, isExpired]);

    // Force results to show if expired
    const displayResults = showResults || isExpired;

    return (
      <VStack className={`bg-zinc-800 rounded-xl border ${isExpired ? 'border-zinc-700/50 opacity-80' : 'border-zinc-700'} gap-2 ${compact ? 'p-4' : 'p-5 gap-4'}`}>
        <HStack className="justify-between items-start">
          <VStack className={`flex-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
            <HStack className="items-center gap-2 mb-1 flex-wrap">
              <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>
                {poll.question}
              </Text>
            </HStack>
            
            {poll.allowMultiple && !isExpired && (
              <Text className={`text-blue-400 font-semibold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
                Select Multiple
              </Text>
            )}
          </VStack>
          
          {/* RIGHT SIDE: Badges and Delete button tightly grouped */}
          <HStack className="items-center gap-3 shrink-0">
            {/* EXPIRED BADGE */}
            {isExpired && (
              <Box className="bg-red-500/20 px-2 py-1 rounded border border-red-500 justify-center">
                <Text className="text-red-400 text-xs font-bold uppercase tracking-wider leading-none">Ended</Text>
              </Box>
            )}
            
            {/* LIVE TIMER BADGE */}
            {!isExpired && expiresAtDate && (
              <Box className="bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50 justify-center">
                <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider leading-none">{timeLeft}</Text>
              </Box>
            )}

            {/* DELETE BUTTON */}
            {deletable && (
              <TouchableOpacity
                onPress={() => handleDeletePoll(poll.id)}
                className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60 justify-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-red-400 text-xs font-semibold leading-none">Delete</Text>
              </TouchableOpacity>
            )}
          </HStack>
        </HStack>

        <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
          {poll.options.map((option: any, index: number) => {
            const hasVoted = option.voterIds.includes(currentUid);
            const voteCount = option.voterIds.length;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={isExpired ? 1 : 0.7} // Disable click animation if expired
                disabled={isExpired} // Block voting touches entirely
                onPress={() => handleVote(poll.id, index, poll.options, poll.allowMultiple)}
                className={`rounded-lg border overflow-hidden relative ${compact ? 'p-3' : 'p-4'} ${hasVoted ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
              >
                {displayResults && (
                  <View 
                    className={`absolute top-0 bottom-0 left-0 ${hasVoted ? 'bg-blue-600/30' : 'bg-zinc-700/50'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                )}
                
                <HStack className="justify-between items-center z-10">
                  <Text className={`font-medium ${compact ? 'text-sm' : ''} ${hasVoted ? 'text-blue-100' : 'text-zinc-300'}`}>
                    {option.text}
                  </Text>
                  <Text className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${hasVoted ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {displayResults ? `${pct}% (${voteCount})` : `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`}
                  </Text>
                </HStack>
              </TouchableOpacity>
            );
          })}
        </VStack>
      </VStack>
    );
  };

// -------------------------------------------------------------------------
  // Header & Event Details
  // -------------------------------------------------------------------------
  
  // Calculate unique headcount by scanning all voters across all active and answered polls
  const uniqueVoters = new Set();
  polls.forEach((poll) => {
    poll.options.forEach((opt: any) => {
      opt.voterIds.forEach((uid: string) => uniqueVoters.add(uid));
    });
  });
  const headcount = uniqueVoters.size;

  const Header = () => (
    <VStack className="gap-2 mb-6">
      <Button variant="link" onPress={() => {if (router.canGoBack()) {
          router.back(); 
        } else {
          router.replace('/dashboard');
        }}} 
        className="self-start p-0 mb-1"
      >
        <ButtonText className="text-blue-500">← Back</ButtonText>
      </Button>

      <HStack className="justify-between items-start w-full flex-wrap gap-4">
        
        {/* Title & Join Code */}
        <VStack className={isMobile ? "w-full" : "flex-1"}>
          <Heading size={isMobile ? '2xl' : '3xl'} className="text-zinc-50">
            {eventData?.title}
          </Heading>
          
          <HStack className="items-center gap-2 mt-2">
            <Text className="text-zinc-400">Join Code:</Text>
            <Box className="bg-zinc-800 px-3 py-1 rounded-md border border-zinc-700">
              <Text className="text-zinc-50 font-mono font-bold tracking-widest">
                {eventData?.joinCode}
              </Text>
            </Box>
          </HStack>

          {/* NEW: Copy Link and QR Code Buttons */}
          <HStack className="items-center gap-4 mt-3">
             <TouchableOpacity onPress={handleCopyLink} className="flex-row items-center gap-1.5 active:opacity-70">
               <Text className="text-blue-400 font-semibold text-sm">Copy Share Link</Text>
             </TouchableOpacity>
             
             <TouchableOpacity onPress={() => setIsQRModalOpen(true)} className="flex-row items-center gap-1.5 active:opacity-70">
               <Text className="text-blue-400 font-semibold text-sm">Show QR Code</Text>
             </TouchableOpacity>

              {/* Native Share Button - Mobile Only */}
              {Platform.OS !== 'web' && isMobile && (
                <TouchableOpacity onPress={handleShare} className="flex-row items-center gap-1.5 active:opacity-70">
                  <Text className="text-blue-400 font-semibold text-sm">Share</Text>
                </TouchableOpacity>
              )}
          </HStack>
        </VStack>

        {/* Vital Signs Box (Now visible on both Mobile and Desktop) */}
        <VStack className={`bg-zinc-800 rounded-2xl p-5 border border-zinc-700 ${isMobile ? 'w-full mt-2' : 'min-w-[240px]'}`}>
          <Heading size="sm" className="text-zinc-400 uppercase tracking-wider mb-3">Event Details</Heading>
          
          <VStack className="gap-3">
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Status</Text>
              <Text className="text-green-400 font-bold">
                {eventData?.status === 'voting' ? 'Active' : 'Closed'}
              </Text>
            </HStack>

            {/* Time Row */}
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Time</Text>
              {!eventData?.time && isOrganizer ? (
                <Button 
                  size="xs" 
                  variant="outline" 
                  className="border-zinc-600 bg-zinc-800 h-7 px-2" 
                  onPress={() => openModal('What time?')}
                >
                  <ButtonText className="text-zinc-300 text-xs">Poll Time</ButtonText>
                </Button>
              ) : (
                <Text className="text-zinc-50 font-semibold">{eventData?.time || 'TBD'}</Text>
              )}
            </HStack>
            
            {/* Location Row */}
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Location</Text>
              {!eventData?.location && isOrganizer ? (
                <Button 
                  size="xs" 
                  variant="outline" 
                  className="border-zinc-600 bg-zinc-800 h-7 px-2" 
                  onPress={() => openModal('Where we going?')}
                >
                  <ButtonText className="text-zinc-300 text-xs">Poll Location</ButtonText>
                </Button>
              ) : (
                <Text className="text-zinc-50 font-semibold text-right max-w-[140px]" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
                  {eventData?.location || 'TBD'}
                </Text>
              )}
            </HStack>

            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Going</Text>
              <Text className="text-zinc-50 font-semibold">
                {headcount} {headcount === 1 ? 'person' : 'people'}
              </Text>
            </HStack>
          </VStack>
        </VStack>

      </HStack>
    </VStack>
  );

  // -------------------------------------------------------------------------
  // Mobile Layout
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <Box className="flex-1 bg-zinc-900">
        <View className="flex-1 px-4 pt-8">
          <Header />

          {/* Tab bar (Reduced to 2 tabs) */}
          <HStack className="bg-zinc-800 rounded-xl p-1 mb-4 border border-zinc-700">
            {(['active', 'answered'] as const).map((tab) => {
              const label = tab === 'active' ? 'Active' : `Answered / Results`;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-zinc-600' : ''}`}
                >
                  <Text className={`text-sm font-semibold ${activeTab === tab ? 'text-zinc-50' : 'text-zinc-400'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </HStack>

          {/* Add Poll Button (Moved below tabs for Organizer) */}
          {isOrganizer && activeTab === 'active' && (
            <Button size="md" action="primary" className="bg-blue-600 border-0 mb-4" onPress={() => setIsModalOpen(true)}>
              <ButtonText className="font-bold text-white">+ Create Poll</ButtonText>
            </Button>
          )}

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <VStack className="gap-4 pb-12">
              {activeTab === 'active' && (
                activePolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">You're all caught up!</Text>
                  </Box>
                ) : (
                  activePolls.map((poll) => <PollCard key={poll.id} poll={poll} deletable={isOrganizer} />)
                )
              )}

              {activeTab === 'answered' && (
                answeredPolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">No answered polls yet.</Text>
                  </Box>
                ) : (
                  // showResults=true embeds the visual progress bars inside the Answered cards
                  answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults deletable={isOrganizer} />)
                )
              )}
            </VStack>
          </ScrollView>
        </View>

        {/* --- ADD THE QR MODAL HERE FOR MOBILE --- */}
        <Modal visible={isQRModalOpen} animationType="fade" transparent>
          <View className="flex-1 justify-center items-center p-4">
            <Pressable
              className="absolute top-0 bottom-0 left-0 right-0 bg-black/80"
              onPress={() => setIsQRModalOpen(false)}
            />
            <View className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 items-center shadow-2xl z-10 w-full max-w-[320px]">
              <Heading size="xl" className="text-zinc-50 mb-1 text-center">Scan to Join</Heading>
              <Text className="text-zinc-400 mb-8 text-center" {...(Platform.OS !== 'web' ? { numberOfLines: 2 } : {})}>
                {eventData?.title}
              </Text>
              
              <View className="bg-white p-4 rounded-2xl mb-6 min-h-[232px] min-w-[232px] justify-center items-center">
                 {joinLink ? (
                   <QRCode 
                     value={joinLink} 
                     size={200} 
                     backgroundColor="white"
                     color="black"
                   />
                 ) : (
                   <Text className="text-zinc-400">Loading QR...</Text>
                 )}
              </View>

              <Text className="text-zinc-500 font-mono tracking-widest font-bold mb-6">
                CODE: {eventData?.joinCode}
              </Text>

              <Button
                size="md"
                variant="outline"
                className="border-zinc-700 w-full bg-zinc-800"
                onPress={() => setIsQRModalOpen(false)}
              >
                <ButtonText className="text-zinc-300 font-bold">Close</ButtonText>
              </Button>
            </View>
          </View>
        </Modal>

        <PollModal visible={isModalOpen} eventId={id as string} onClose={() => setIsModalOpen(false)} />
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Desktop Layout (2 Columns: Active | Answered & Results)
  // -------------------------------------------------------------------------
  return (
    <Box className="flex-1 bg-zinc-900 items-center">
      {/* Reduced to max-w-5xl since we only have 2 columns now */}
      <View className="w-full max-w-5xl flex-1 px-6 pt-6">
        <Header />

        {/* 2-column grid */}
        <View className="flex-1 flex-col md:flex-row gap-8 w-full pb-6">

          {/* LEFT: Active Polls */}
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
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">You're all caught up!</Text>
                  </Box>
                ) : (
                  activePolls.map((poll) => <PollCard key={poll.id} poll={poll} deletable={isOrganizer} />)
                )}
              </VStack>
            </ScrollView>
          </View>

          {/* RIGHT: Answered / Results */}
          <View className="flex-1">
            <Heading size="xl" className="text-zinc-50 mb-4 mt-1">Answered / Results</Heading>
            
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-4 pb-12">
                {answeredPolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">No answered polls yet.</Text>
                  </Box>
                ) : (
                  // showResults=true embeds the visual progress bars inside the Answered cards
                  answeredPolls.map((poll) => <PollCard key={poll.id} poll={poll} compact showResults deletable={isOrganizer}/>)
                )}
              </VStack>
            </ScrollView>
          </View>

        </View>
      </View>
      
      {/* QR Code Modal */}
      <Modal visible={isQRModalOpen} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center p-4">
          <Pressable
            className="absolute top-0 bottom-0 left-0 right-0 bg-black/80"
            onPress={() => setIsQRModalOpen(false)}
          />
          <View className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 items-center shadow-2xl z-10 w-full max-w-[320px]">
            <Heading size="xl" className="text-zinc-50 mb-1 text-center">Scan to Join</Heading>
            <Text className="text-zinc-400 mb-8 text-center" {...(Platform.OS !== 'web' ? { numberOfLines: 2 } : {})}>
              {eventData?.title}
            </Text>
            
            <View className="bg-white p-4 rounded-2xl mb-6 min-h-[232px] min-w-[232px] justify-center items-center">
               {/* Only render when joinLink is absolutely ready */}
               {joinLink ? (
                 <QRCode 
                   value={joinLink} 
                   size={200} 
                   backgroundColor="white"
                   color="black"
                 />
               ) : (
                 <Text className="text-zinc-400">Loading QR...</Text>
               )}
            </View>

            <Text className="text-zinc-500 font-mono tracking-widest font-bold mb-6">
              CODE: {eventData?.joinCode}
            </Text>

            <Button
              size="md"
              variant="outline"
              className="border-zinc-700 w-full bg-zinc-800"
              onPress={() => setIsQRModalOpen(false)}
            >
              <ButtonText className="text-zinc-300 font-bold">Close</ButtonText>
            </Button>
          </View>
        </View>
      </Modal>

      <PollModal 
        visible={isModalOpen} 
        eventId={id as string} 
        onClose={() => setIsModalOpen(false)} 
        initialQuestion={modalConfig.question}
        initialChoices={modalConfig.choices}
      />
    </Box>
  );
}