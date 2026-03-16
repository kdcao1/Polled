import React, { useState, useEffect } from 'react';
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

type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

const DURATION_UNITS: Array<{ label: string; value: DurationUnit }> = [
  { label: 'Seconds', value: 'seconds' },
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
];

const durationToMs = (amountInput: string | number, unit: DurationUnit) => {
  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const multipliers: Record<DurationUnit, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const formatDurationLabel = (amountInput: string | number, unit: DurationUnit) => {
  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a time limit';
  const singular = unit.slice(0, -1);
  return `${amount} ${amount === 1 ? singular : unit}`;
};

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [durationAmount, setDurationAmount] = useState('24');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');

  const QUICK_DURATIONS: Array<{ label: string; amount: string; unit: DurationUnit }> = [
    { label: '30 sec', amount: '30', unit: 'seconds' },
    { label: '5 min', amount: '5', unit: 'minutes' },
    { label: '1 hour', amount: '1', unit: 'hours' },
    { label: '1 day', amount: '1', unit: 'days' },
    { label: '1 week', amount: '1', unit: 'weeks' },
  ];

  useEffect(() => {
    if (visible) {
      setQuestion(initialQuestion || '');
      setChoices(initialChoices && initialChoices.length > 0 ? initialChoices : ['', '']);
      setAllowMultiple(false);
      setIsDropdownOpen(false);
      setDurationAmount('24');
      setDurationUnit('hours');
    }
  }, [visible, initialQuestion, initialChoices]);

  const handleClearForm = () => {
    setQuestion('');
    setChoices(['', '']);
    setAllowMultiple(false);
    setDurationAmount('24');
    setDurationUnit('hours');
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

    const durationMs = durationToMs(durationAmount, durationUnit);
    if (!durationMs) {
      alert('Please enter a valid time limit.');
      return;
    }

    try {
      const pollsRef = collection(db, 'events', eventId, 'polls');
      const expiresAt = new Date(Date.now() + durationMs);

      await addDoc(pollsRef, {
        question: question.trim(),
        allowMultiple,
        options: choices.map((c) => ({ text: c.trim(), voterIds: [] })),
        createdAt: serverTimestamp(),
        status: 'active',
        expiresAt,
      });
      
      handleClearForm();
      onClose();
      setTimeout(() => onClose(), 0);
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

              <VStack className="gap-3 mt-2">
                <Text className="text-zinc-300 font-bold ml-1">Poll Duration</Text>

                <HStack className="gap-2 flex-wrap">
                  {QUICK_DURATIONS.map((preset) => {
                    const active = durationAmount === preset.amount && durationUnit === preset.unit;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        activeOpacity={0.7}
                        className={`px-3 py-2 rounded-full border ${active ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-800 border-zinc-700'}`}
                        onPress={() => {
                          setDurationAmount(preset.amount);
                          setDurationUnit(preset.unit);
                        }}
                      >
                        <Text className={`${active ? 'text-blue-300' : 'text-zinc-300'} text-xs font-semibold`}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </HStack>

                <HStack className="gap-3 items-center">
                  <View className="flex-1">
                    <Input variant="outline" size="xl" className="border-zinc-700">
                      <InputField
                        placeholder="24"
                        placeholderTextColor="#52525b"
                        className="text-zinc-50"
                        keyboardType="numeric"
                        value={durationAmount}
                        onChangeText={(text) => setDurationAmount(text.replace(/[^0-9.]/g, ''))}
                      />
                    </Input>
                  </View>

                  <TouchableOpacity 
                    activeOpacity={0.7}
                    className="min-w-[140px] bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center"
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <Text className="text-zinc-50 font-medium text-base">
                      {DURATION_UNITS.find(opt => opt.value === durationUnit)?.label}
                    </Text>
                    <Text className="text-zinc-400 text-xs">
                      {isDropdownOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                </HStack>

                <Text className="text-zinc-500 text-sm ml-1">
                  Ends in {formatDurationLabel(durationAmount, durationUnit)}
                </Text>

                {Platform.OS === 'web' && isDropdownOpen && (
                  <View className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden mt-1 max-h-48">
                    <ScrollView nestedScrollEnabled={true}>
                      {DURATION_UNITS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          className={`p-4 border-b border-zinc-700/50 ${durationUnit === option.value ? 'bg-zinc-700' : ''}`}
                          onPress={() => {
                            setDurationUnit(option.value);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <Text className={`font-medium ${durationUnit === option.value ? 'text-blue-400' : 'text-zinc-300'}`}>
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
                <ButtonText className="font-bold text-white" // onPress={onClose}
                >
                  Publish Poll
                </ButtonText>
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
                  {DURATION_UNITS.map((option, index) => {
                    const isSelected = durationUnit === option.value;
                    const isLast = index === DURATION_UNITS.length - 1;
                    
                    return (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.7}
                        className={`flex-row justify-between items-center p-5 ${!isLast ? 'border-b border-zinc-700/50' : ''}`}
                        onPress={() => {
                          setDurationUnit(option.value);
                          setTimeout(() => setIsDropdownOpen(false), 200); 
                        }}
                      >
                        <Text className={`text-base ${isSelected ? 'text-zinc-50 font-medium' : 'text-zinc-300'}`}>
                          {option.label}
                        </Text>
                        
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


interface ExtendPollModalProps {
  visible: boolean;
  poll: any | null;
  onClose: () => void;
  onConfirm: (pollId: string, amount: string, unit: DurationUnit) => Promise<void>;
}

function ExtendPollModal({ visible, poll, onClose, onConfirm }: ExtendPollModalProps) {
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<DurationUnit>('hours');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('1');
      setUnit('hours');
      setIsDropdownOpen(false);
    }
  }, [visible, poll?.id]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-md z-10">
          <HStack className="justify-between items-center mb-5">
            <VStack className="flex-1 pr-4">
              <Heading size="lg" className="text-zinc-50">Extend Poll</Heading>
              <Text className="text-zinc-400 mt-1">{poll?.question || ''}</Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <VStack className="gap-4">
            <HStack className="gap-3 items-center">
              <View className="flex-1">
                <Input variant="outline" size="xl" className="border-zinc-700">
                  <InputField
                    placeholder="1"
                    placeholderTextColor="#52525b"
                    className="text-zinc-50"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                  />
                </Input>
              </View>

              <TouchableOpacity 
                activeOpacity={0.7}
                className="min-w-[140px] bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center"
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <Text className="text-zinc-50 font-medium text-base">
                  {DURATION_UNITS.find(opt => opt.value === unit)?.label}
                </Text>
                <Text className="text-zinc-400 text-xs">
                  {isDropdownOpen ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            </HStack>

            <Text className="text-zinc-500 text-sm">
              Add {formatDurationLabel(amount, unit)} to this poll
            </Text>

            {isDropdownOpen && (
              <View className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                {DURATION_UNITS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`p-4 border-b border-zinc-700/50 ${unit === option.value ? 'bg-zinc-700' : ''}`}
                    onPress={() => {
                      setUnit(option.value);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <Text className={`font-medium ${unit === option.value ? 'text-blue-400' : 'text-zinc-300'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Button
              size="xl"
              action="primary"
              className="bg-blue-600 border-0 mt-2"
              onPress={() => poll?.id && onConfirm(poll.id, amount, unit)}
            >
              <ButtonText className="font-bold text-white" // onPress={onClose}
              >Extend Poll</ButtonText>
            </Button>
          </VStack>
        </View>
      </View>
    </Modal>
  );
}

const formatLargestUnit = (value: number, singular: string, plural: string) => {
  const safeValue = Math.max(1, Math.floor(value));
  return `${safeValue} ${safeValue === 1 ? singular : plural}`;
};

const formatTimeLeft = (expirationDate: Date) => {
  const diffMs = expirationDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Ended';

  const seconds = diffMs / 1000;
  const minutes = diffMs / (60 * 1000);
  const hours = diffMs / (60 * 60 * 1000);
  const days = diffMs / (24 * 60 * 60 * 1000);
  const weeks = diffMs / (7 * 24 * 60 * 60 * 1000);

  if (weeks >= 1) return `Ends in ${formatLargestUnit(weeks, 'week', 'weeks')}`;
  if (days >= 1) return `Ends in ${formatLargestUnit(days, 'day', 'days')}`;
  if (hours >= 1) return `Ends in ${formatLargestUnit(hours, 'hour', 'hours')}`;
  if (minutes >= 1) return `Ends in ${formatLargestUnit(minutes, 'minute', 'minutes')}`;
  return `Ends in ${formatLargestUnit(seconds, 'second', 'seconds')}`;
};


const summarizePolls = (polls: any[]) => {
  const totalPolls = polls.length;
  let totalVotes = 0;

  const topPolls = polls
    .map((poll) => {
      const options = Array.isArray(poll.options) ? poll.options : [];
      const total = options.reduce((sum: number, option: any) => sum + (option.voterIds?.length || 0), 0);
      totalVotes += total;
      const sorted = [...options].sort((a, b) => (b.voterIds?.length || 0) - (a.voterIds?.length || 0));
      const winner = sorted[0];
      return winner
        ? {
            question: poll.question || 'Untitled poll',
            topChoice: winner.text || 'TBD',
            topVotes: winner.voterIds?.length || 0,
            totalVotes: total,
          }
        : null;
    })
    .filter(Boolean);

  return { totalPolls, totalVotes, topPolls };
};

const deriveEventMeta = (eventData: any, polls: any[]) => {
  const summary = summarizePolls(polls);
  const now = new Date();
  const normalizedPolls = polls.map((poll) => {
    const expiresAt = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
    return { ...poll, expiresAt };
  });

  const activePolls = normalizedPolls.filter((poll) => !poll.expiresAt || poll.expiresAt > now);
  const nextExpiry = activePolls
    .map((poll) => poll.expiresAt?.getTime?.() ?? Infinity)
    .sort((a, b) => a - b)[0];

  let status = 'getting_votes';
  if (eventData?.status === 'completed') {
    status = 'completed';
  } else if (summary.totalPolls === 0) {
    status = 'getting_votes';
  } else if (activePolls.length === 0) {
    status = 'completed';
  } else if (Number.isFinite(nextExpiry) && nextExpiry - now.getTime() <= 6 * 60 * 60 * 1000) {
    status = 'closing_soon';
  }

  const chooseWinner = (keyword: 'time' | 'location') => {
    const match = normalizedPolls.find((poll) => (poll.question || '').toLowerCase().includes(keyword));
    if (!match?.options?.length) return '';
    const winner = [...match.options].sort((a, b) => (b.voterIds?.length || 0) - (a.voterIds?.length || 0))[0];
    return winner?.text || '';
  };

  return {
    summary,
    status,
    time: eventData?.time || chooseWinner('time'),
    location: eventData?.location || chooseWinner('location'),
  };
};

const statusLabelMap: Record<string, string> = {
  getting_votes: 'Getting votes',
  closing_soon: 'Closing soon',
  completed: 'Completed',
  voting: 'Getting votes',
};

const isPollExpired = (poll: any) => {
  const expiresAt = poll?.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll?.expiresAt ? new Date(poll.expiresAt) : null);
  return expiresAt ? new Date() > expiresAt : false;
};

const statusTextClass = (status?: string) => {
  switch (status) {
    case 'completed':
      return 'text-zinc-400';
    case 'closing_soon':
      return 'text-amber-400';
    default:
      return 'text-green-400';
  }
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
  const [extendPoll, setExtendPoll] = useState<any | null>(null);

  const closePollModal = () => {
    setIsModalOpen(false);
    setModalConfig({});
  };

  const joinLink = React.useMemo(() => {
    const code = eventData?.joinCode || '';
    if (!code) return '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}/join?code=${code}`;
    }
    return `polled://join?code=${code}`;
  }, [eventData?.joinCode]);

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

  useEffect(() => {
    if (!id || !eventData) return;

    const syncDerivedFields = async () => {
      const derived = deriveEventMeta(eventData, polls);
      const summaryChanged = JSON.stringify(eventData.summary || null) !== JSON.stringify(derived.summary);
      const statusChanged = (eventData.status || 'getting_votes') !== derived.status;
      const timeChanged = (eventData.time || '') !== (derived.time || '');
      const locationChanged = (eventData.location || '') !== (derived.location || '');

      if (!summaryChanged && !statusChanged && !timeChanged && !locationChanged) return;

      try {
        await updateDoc(doc(db, 'events', id as string), {
          summary: derived.summary,
          status: derived.status,
          time: derived.time,
          location: derived.location,
        });
      } catch (error) {
        console.error('Error syncing event summary:', error);
      }
    };

    syncDerivedFields();
  }, [id, eventData, polls]);

  const handleEndPollNow = async (pollId: string) => {
    if (!id) return;

    try {
      await updateDoc(doc(db, 'events', id as string, 'polls', pollId), {
        expiresAt: new Date(),
        status: 'ended',
      });
    } catch (error) {
      console.error('Error ending poll:', error);
    }
  };

  const handleExtendPoll = async (pollId: string, amount: string, unit: DurationUnit) => {
    if (!id) return;

    const durationMs = durationToMs(amount, unit);
    if (!durationMs) {
      alert('Please enter a valid extension.');
      return;
    }

    const poll = polls.find((item) => item.id === pollId);
    if (!poll) return;

    const currentExpiry = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
    const baseTime = currentExpiry && currentExpiry > new Date() ? currentExpiry.getTime() : Date.now();
    const nextExpiry = new Date(baseTime + durationMs);

    try {
      await updateDoc(doc(db, 'events', id as string, 'polls', pollId), {
        expiresAt: nextExpiry,
        status: 'active',
      });
      setExtendPoll(null);
    } catch (error) {
      console.error('Error extending poll:', error);
    }
  };

  const handleSubmitVote = async (pollId: string, selectedIndices: number[], currentOptions: any[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const poll = polls.find((p) => p.id === pollId);
    if (!poll || isPollExpired(poll)) {
      alert('This poll has ended.');
      return;
    }

    if (!selectedIndices.length) return;

    const newOptions = currentOptions.map((opt: any, index: number) => ({
      ...opt,
      voterIds: [
        ...(opt.voterIds || []).filter((v: string) => v !== uid),
        ...(selectedIndices.includes(index) ? [uid] : []),
      ],
    }));

    try {
      const pollRef = doc(db, 'events', id as string, 'polls', pollId);
      await updateDoc(pollRef, { options: newOptions });
    } catch (error) {
      console.error('Error updating vote:', error);
    }
  };

  const handleFinalizeEvent = async () => {
    if (!id || !eventData) return;
    const derived = deriveEventMeta(eventData, polls);

    try {
      await updateDoc(doc(db, 'events', id as string), {
        summary: derived.summary,
        status: 'completed',
        time: derived.time,
        location: derived.location,
        finalizedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error finalizing event:', error);
    }
  };

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
  const activePolls = polls.filter((poll) => {
    const hasAnswered = poll.options.some((opt: any) => opt.voterIds.includes(currentUid));
    return !hasAnswered && !isPollExpired(poll);
  });
  const answeredPolls = polls.filter((poll) => {
    const hasAnswered = poll.options.some((opt: any) => opt.voterIds.includes(currentUid));
    return hasAnswered || isPollExpired(poll);
  });

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

    const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
    const [isExpired, setIsExpired] = useState(() => expiresAtDate ? new Date() > expiresAtDate : false);
    const [timeLeft, setTimeLeft] = useState(() => expiresAtDate && !isExpired ? formatTimeLeft(expiresAtDate) : '');
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      if (!expiresAtDate || isExpired) return;

      const interval = setInterval(() => {
        if (new Date() > expiresAtDate) {
          setIsExpired(true);
          setTimeLeft('Ended');
          clearInterval(interval);
        } else {
          setTimeLeft(formatTimeLeft(expiresAtDate));
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [expiresAtDate, isExpired]);

    const displayResults = showResults || isExpired;

    const handleSelectOption = (index: number) => {
      if (displayResults) return;
      if (poll.allowMultiple) {
        setSelectedIndices((current) =>
          current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
        );
      } else {
        setSelectedIndices([index]);
      }
    };

    const submitSelection = async () => {
      if (!selectedIndices.length || isSubmitting) return;
      setIsSubmitting(true);
      try {
        await handleSubmitVote(poll.id, selectedIndices, poll.options);
        setSelectedIndices([]);
      } finally {
        setIsSubmitting(false);
      }
    };

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
                Select multiple, then confirm
              </Text>
            )}
          </VStack>
          
          <VStack className="items-end gap-2 shrink-0">
            <HStack className="items-center gap-3 shrink-0 flex-wrap justify-end">
              {isExpired && (
                <Box className="bg-red-500/20 px-2 py-1 rounded border border-red-500 justify-center">
                  <Text className="text-red-400 text-xs font-bold uppercase tracking-wider leading-none">Ended</Text>
                </Box>
              )}
              
              {!isExpired && expiresAtDate && (
                <Box className="bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50 justify-center">
                  <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider leading-none">{timeLeft}</Text>
                </Box>
              )}
            </HStack>

            {deletable && (
              <HStack className="items-center gap-2 flex-wrap justify-end">
                {!isExpired && (
                  <>
                    <TouchableOpacity
                      onPress={() => setExtendPoll(poll)}
                      className="bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-1 active:bg-blue-900/60 justify-center"
                    >
                      <Text className="text-blue-300 text-xs font-semibold leading-none">Extend time</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleEndPollNow(poll.id)}
                      className="bg-amber-900/30 border border-amber-800/50 rounded-lg px-3 py-1 active:bg-amber-900/60 justify-center"
                    >
                      <Text className="text-amber-300 text-xs font-semibold leading-none">End now</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  onPress={() => handleDeletePoll(poll.id)}
                  className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60 justify-center"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-red-400 text-xs font-semibold leading-none">Delete</Text>
                </TouchableOpacity>
              </HStack>
            )}
          </VStack>
        </HStack>

        <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
          {poll.options.map((option: any, index: number) => {
            const hasVoted = option.voterIds.includes(currentUid);
            const isSelected = selectedIndices.includes(index);
            const voteCount = option.voterIds.length;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={displayResults ? 1 : 0.7}
                disabled={displayResults}
                onPress={() => handleSelectOption(index)}
                className={`rounded-lg border overflow-hidden relative ${compact ? 'p-3' : 'p-4'} ${hasVoted || isSelected ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
              >
                {displayResults && (
                  <View 
                    className={`absolute top-0 bottom-0 left-0 ${hasVoted ? 'bg-blue-600/30' : 'bg-zinc-700/50'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                )}
                
                <HStack className="justify-between items-center z-10 gap-3">
                  <Text className={`font-medium ${compact ? 'text-sm' : ''} ${hasVoted || isSelected ? 'text-blue-100' : 'text-zinc-300'}`}>
                    {option.text}
                  </Text>
                  <Text className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${hasVoted || isSelected ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {displayResults ? `${pct}% (${voteCount})` : `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`}
                  </Text>
                </HStack>
              </TouchableOpacity>
            );
          })}
        </VStack>

        {!displayResults && (
          <Button
            size={compact ? 'sm' : 'md'}
            action="primary"
            className={`bg-blue-600 border-0 mt-2 ${selectedIndices.length ? '' : 'opacity-60'}`}
            onPress={submitSelection}
            isDisabled={!selectedIndices.length || isSubmitting}
          >
            <ButtonText className="font-bold text-white">
              {isSubmitting ? 'Submitting...' : poll.allowMultiple ? 'Confirm choices' : 'Confirm choice'}
            </ButtonText>
          </Button>
        )}
      </VStack>
    );
  };

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
          {eventData?.description ? (
            <Text className="text-zinc-400 mt-2 max-w-2xl">{eventData.description}</Text>
          ) : null}

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
              <Text className={`${statusTextClass(eventData?.status)} font-bold`}>
                {statusLabelMap[eventData?.status || 'getting_votes'] || 'Getting votes'}
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

            {isOrganizer && eventData?.status !== 'completed' ? (
              <Button size="sm" variant="outline" className="border-zinc-600 mt-2" onPress={handleFinalizeEvent}>
                <ButtonText className="text-zinc-50 font-semibold">Finalize Event</ButtonText>
              </Button>
            ) : null}
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

        <PollModal
          visible={isModalOpen}
          eventId={id as string}
          onClose={closePollModal}
          initialQuestion={modalConfig.question}
          initialChoices={modalConfig.choices}
        />
        <ExtendPollModal
          visible={!!extendPoll}
          poll={extendPoll}
          onClose={() => setExtendPoll(null)}
          onConfirm={handleExtendPoll}
        />
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
        onClose={closePollModal} 
        initialQuestion={modalConfig.question}
        initialChoices={modalConfig.choices}
      />
      <ExtendPollModal
        visible={!!extendPoll}
        poll={extendPoll}
        onClose={() => setExtendPoll(null)}
        onConfirm={handleExtendPoll}
      />
    </Box>
  );
}