import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Pressable,
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

// ---------------------------------------------------------------------------
// Quick-poll templates (organizer one-tap creation)
// ---------------------------------------------------------------------------
const QUICK_TEMPLATES = [
  { label: 'Yes / No', question: 'Yes or No?', choices: ['Yes', 'No'] },
  {
    label: 'Agree / Disagree',
    question: 'Agree or disagree?',
    choices: ['Agree', 'Disagree', 'Neutral'],
  },
  {
    label: 'Rate 1–5',
    question: 'Rate from 1 to 5',
    choices: ['1', '2', '3', '4', '5'],
  },
  {
    label: 'For / Against',
    question: 'For or against?',
    choices: ['For', 'Against', 'Abstain'],
  },
];

// ---------------------------------------------------------------------------
// Summary computation helper
// ---------------------------------------------------------------------------
function computeSummary(pollList: any[]) {
  const totalVotes = pollList.reduce(
    (sum, poll) =>
      sum +
      poll.options.reduce((s: number, opt: any) => s + opt.voterIds.length, 0),
    0
  );
  const topPolls = pollList.map((poll) => {
    const totalForPoll = poll.options.reduce(
      (s: number, o: any) => s + o.voterIds.length,
      0
    );
    const topOption = poll.options.reduce(
      (a: any, b: any) => (a.voterIds.length >= b.voterIds.length ? a : b),
      poll.options[0] ?? { text: '', voterIds: [] }
    );
    return {
      question: poll.question,
      topChoice: topOption?.text ?? '',
      topVotes: topOption?.voterIds.length ?? 0,
      totalVotes: totalForPoll,
    };
  });
  return { totalPolls: pollList.length, totalVotes, topPolls };
}

// ---------------------------------------------------------------------------
// Poll results view (used in Summary tab + organizer sidebar on desktop)
// ---------------------------------------------------------------------------
function SummaryView({ polls }: { polls: any[] }) {
  if (polls.length === 0) {
    return (
      <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
        <Text className="text-zinc-500">No polls yet.</Text>
      </Box>
    );
  }

  return (
    <VStack className="gap-4">
      {polls.map((poll) => {
        const totalVotes = poll.options.reduce(
          (s: number, o: any) => s + o.voterIds.length,
          0
        );
        return (
          <VStack
            key={poll.id}
            className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 gap-3"
          >
            <Text className="text-zinc-50 font-bold text-base">
              {poll.question}
            </Text>
            <VStack className="gap-2">
              {poll.options.map((option: any, i: number) => {
                const pct =
                  totalVotes > 0
                    ? Math.round((option.voterIds.length / totalVotes) * 100)
                    : 0;
                return (
                  <VStack key={i} className="gap-1">
                    <HStack className="justify-between">
                      <Text className="text-zinc-300 text-sm flex-1 mr-2">
                        {option.text}
                      </Text>
                      <Text className="text-zinc-400 text-sm font-bold">
                        {pct}% ({option.voterIds.length})
                      </Text>
                    </HStack>
                    <View className="bg-zinc-700 rounded-full overflow-hidden" style={{ height: 6 }}>
                      <View
                        className="bg-blue-500 rounded-full"
                        style={{ width: `${pct}%`, height: 6 }}
                      />
                    </View>
                  </VStack>
                );
              })}
            </VStack>
            <Text className="text-zinc-500 text-xs">
              {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
            </Text>
          </VStack>
        );
      })}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// PollModal — owns all form state so typing never re-renders EventScreen
// ---------------------------------------------------------------------------
interface PollModalProps {
  visible: boolean;
  initialQuestion: string;
  initialChoices: string[];
  eventId: string;
  onClose: () => void;
}

function PollModal({ visible, initialQuestion, initialChoices, eventId, onClose }: PollModalProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [choices, setChoices] = useState<string[]>(initialChoices);
  const [allowMultiple, setAllowMultiple] = useState(false);

  // Sync initial values each time the modal opens
  useEffect(() => {
    if (visible) {
      setQuestion(initialQuestion);
      setChoices(initialChoices);
      setAllowMultiple(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearForm = () => {
    setQuestion('');
    setChoices(['', '']);
    setAllowMultiple(false);
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
      await addDoc(pollsRef, {
        question: question.trim(),
        allowMultiple,
        options: choices.map((c) => ({ text: c.trim(), voterIds: [] })),
        createdAt: serverTimestamp(),
        status: 'active',
      });
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
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Event state
  const [eventData, setEventData] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Mobile tab: 'active' | 'answered' | 'results'
  const [activeTab, setActiveTab] = useState<'active' | 'answered' | 'results'>('active');

  // Modal open state + initial values for pre-filling from quick templates
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialQuestion, setModalInitialQuestion] = useState('');
  const [modalInitialChoices, setModalInitialChoices] = useState(['', '']);

  // Track last-written summary to avoid redundant Firestore writes
  const lastSummaryKeyRef = useRef('');

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

  // Sync summary to the event doc whenever polls change (organizer only)
  useEffect(() => {
    if (!isOrganizer || !id || polls.length === 0) return;
    const summary = computeSummary(polls);
    const key = JSON.stringify(summary);
    if (key === lastSummaryKeyRef.current) return;
    lastSummaryKeyRef.current = key;
    updateDoc(doc(db, 'events', id as string), { summary }).catch(console.error);
  }, [polls, isOrganizer, id]);

  // Vote handler
  const handleVote = async (
    pollId: string,
    optionIndex: number,
    currentOptions: any[],
    allowMultipleVotes: boolean
  ) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const newOptions = currentOptions.map((opt) => ({
      ...opt,
      voterIds: [...opt.voterIds],
    }));

    const hasVotedForThis = newOptions[optionIndex].voterIds.includes(uid);

    if (allowMultipleVotes) {
      if (hasVotedForThis) {
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter(
          (v: string) => v !== uid
        );
      } else {
        newOptions[optionIndex].voterIds.push(uid);
      }
    } else {
      if (hasVotedForThis) {
        newOptions[optionIndex].voterIds = newOptions[optionIndex].voterIds.filter(
          (v: string) => v !== uid
        );
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

  // Quick poll — pre-fill modal with template so organizer can edit the title
  const handleQuickPoll = (template: (typeof QUICK_TEMPLATES)[0]) => {
    setModalInitialQuestion(template.question);
    setModalInitialChoices(template.choices);
    setIsModalOpen(true);
  };

  const openCustomModal = () => {
    setModalInitialQuestion('');
    setModalInitialChoices(['', '']);
    setIsModalOpen(true);
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
  // Shared sub-components
  // -------------------------------------------------------------------------

  const PollCard = ({
    poll,
    compact = false,
    deletable = false,
  }: {
    poll: any;
    compact?: boolean;
    deletable?: boolean;
  }) => (
    <VStack
      className={`bg-zinc-800 rounded-xl border border-zinc-700 gap-2 ${
        compact ? 'p-4 opacity-75' : 'p-5 gap-4'
      }`}
    >
      <HStack className="justify-between items-start">
        <VStack className={`flex-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
          <Text
            className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}
          >
            {poll.question}
          </Text>
          {poll.allowMultiple && (
            <Text
              className={`text-blue-400 font-semibold uppercase tracking-wider ${
                compact ? 'text-[10px]' : 'text-xs'
              }`}
            >
              Select Multiple
            </Text>
          )}
        </VStack>
        {deletable && (
          <TouchableOpacity
            onPress={() => handleDeletePoll(poll.id)}
            className="ml-3 mt-0.5 bg-zinc-700 rounded-lg px-2 py-1 active:bg-red-900/50"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-zinc-400 text-xs font-semibold">Delete</Text>
          </TouchableOpacity>
        )}
      </HStack>

      <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
        {poll.options.map((option: any, index: number) => {
          const hasVoted = option.voterIds.includes(currentUid);
          const voteCount = option.voterIds.length;
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() =>
                handleVote(poll.id, index, poll.options, poll.allowMultiple)
              }
              className={`rounded-lg border ${
                compact ? 'p-3' : 'p-4'
              } ${
                hasVoted
                  ? 'bg-blue-900/40 border-blue-500'
                  : 'bg-zinc-900/50 border-zinc-700'
              }`}
            >
              <HStack className="justify-between items-center">
                <Text
                  className={`font-medium ${compact ? 'text-sm' : ''} ${
                    hasVoted ? 'text-blue-100' : 'text-zinc-300'
                  }`}
                >
                  {option.text}
                </Text>
                <Text
                  className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${
                    hasVoted ? 'text-blue-400' : 'text-zinc-500'
                  }`}
                >
                  {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                </Text>
              </HStack>
            </TouchableOpacity>
          );
        })}
      </VStack>
    </VStack>
  );

  const QuickTemplates = () => (
    <VStack className="gap-2 mb-4">
      <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider ml-1">
        Quick Polls
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack className="gap-2">
          {QUICK_TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.label}
              onPress={() => handleQuickPoll(t)}
              className="bg-zinc-800 border border-zinc-600 rounded-full px-4 py-2 active:bg-zinc-700"
            >
              <Text className="text-zinc-300 text-sm font-medium">{t.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={openCustomModal}
            className="bg-blue-900/50 border border-blue-600 rounded-full px-4 py-2 active:bg-blue-900"
          >
            <Text className="text-blue-400 text-sm font-bold">+ Custom</Text>
          </TouchableOpacity>
        </HStack>
      </ScrollView>
    </VStack>
  );

  // -------------------------------------------------------------------------
  // Header (shared between mobile and desktop)
  // -------------------------------------------------------------------------
  const Header = () => (
    <VStack className="gap-2 mb-4">
      <Button
        variant="link"
        onPress={() => router.replace('/dashboard')}
        className="self-start p-0 mb-1"
      >
        <ButtonText className="text-blue-500">← Back</ButtonText>
      </Button>

      <HStack className="justify-between items-start w-full flex-wrap gap-4">
        <VStack className="flex-1">
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
        </VStack>

        {/* Event details card — hidden on mobile (visible in Results tab) */}
        {!isMobile && (
          <VStack className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700 min-w-[200px]">
            <Heading size="sm" className="text-zinc-400 uppercase tracking-wider mb-2">
              Event Details
            </Heading>
            <VStack className="gap-2">
              <HStack className="justify-between gap-6">
                <Text className="text-zinc-400">Status</Text>
                <Text className="text-green-400 font-bold">
                  {eventData?.status === 'voting' ? 'Active' : 'Closed'}
                </Text>
              </HStack>
              <HStack className="justify-between gap-6">
                <Text className="text-zinc-400">Polls</Text>
                <Text className="text-zinc-50 font-semibold">{polls.length}</Text>
              </HStack>
              <HStack className="justify-between gap-6">
                <Text className="text-zinc-400">Votes</Text>
                <Text className="text-zinc-50 font-semibold">
                  {polls.reduce(
                    (s, p) =>
                      s +
                      p.options.reduce(
                        (ss: number, o: any) => ss + o.voterIds.length,
                        0
                      ),
                    0
                  )}
                </Text>
              </HStack>
            </VStack>
          </VStack>
        )}
      </HStack>
    </VStack>
  );

  // -------------------------------------------------------------------------
  // Mobile layout
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <Box className="flex-1 bg-zinc-900">
        <View className="flex-1 px-4 pt-8">
          <Header />

          {/* Quick templates for organizer */}
          {isOrganizer && <QuickTemplates />}

          {/* Tab bar */}
          <HStack className="bg-zinc-800 rounded-xl p-1 mb-4 border border-zinc-700">
            {(['active', 'answered', 'results'] as const).map((tab) => {
              const label =
                tab === 'active'
                  ? `Active (${activePolls.length})`
                  : tab === 'answered'
                  ? `Answered (${answeredPolls.length})`
                  : 'Results';
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    activeTab === tab ? 'bg-zinc-600' : ''
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      activeTab === tab ? 'text-zinc-50' : 'text-zinc-400'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </HStack>

          {/* Tab content */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <VStack className="gap-4 pb-12">
              {activeTab === 'active' && (
                activePolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">You're all caught up!</Text>
                  </Box>
                ) : (
                  activePolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} deletable={isOrganizer} />
                  ))
                )
              )}

              {activeTab === 'answered' && (
                answeredPolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">No answered polls yet.</Text>
                  </Box>
                ) : (
                  answeredPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} compact />
                  ))
                )
              )}

              {activeTab === 'results' && (
                <VStack className="gap-4">
                  {/* Mini event details on mobile Results tab */}
                  <VStack className="bg-zinc-800 rounded-2xl p-4 border border-zinc-700 gap-2">
                    <HStack className="justify-between">
                      <Text className="text-zinc-400">Status</Text>
                      <Text className="text-green-400 font-bold">
                        {eventData?.status === 'voting' ? 'Active' : 'Closed'}
                      </Text>
                    </HStack>
                    <HStack className="justify-between">
                      <Text className="text-zinc-400">Total Polls</Text>
                      <Text className="text-zinc-50 font-semibold">{polls.length}</Text>
                    </HStack>
                    <HStack className="justify-between">
                      <Text className="text-zinc-400">Total Votes</Text>
                      <Text className="text-zinc-50 font-semibold">
                        {polls.reduce(
                          (s, p) =>
                            s +
                            p.options.reduce(
                              (ss: number, o: any) => ss + o.voterIds.length,
                              0
                            ),
                          0
                        )}
                      </Text>
                    </HStack>
                  </VStack>
                  <SummaryView polls={polls} />
                </VStack>
              )}
            </VStack>
          </ScrollView>
        </View>

        <PollModal
          visible={isModalOpen}
          initialQuestion={modalInitialQuestion}
          initialChoices={modalInitialChoices}
          eventId={id as string}
          onClose={() => setIsModalOpen(false)}
        />
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // Desktop layout (3 columns: Active | Answered | Results)
  // -------------------------------------------------------------------------
  return (
    <Box className="flex-1 bg-zinc-900 items-center">
      <View className="w-full max-w-6xl flex-1 px-6 pt-6">
        <Header />

        {/* Quick templates for organizer */}
        {isOrganizer && <QuickTemplates />}

        {/* 3-column grid */}
        <View className="flex-1 flex-row gap-6 w-full pb-6">

          {/* LEFT: Active Polls */}
          <View className="flex-1">
            <HStack className="justify-between items-end mb-4 mt-1">
              <Heading size="xl" className="text-zinc-50">
                Active ({activePolls.length})
              </Heading>
              {isOrganizer && (
                <Button
                  size="sm"
                  action="primary"
                  className="bg-blue-600 border-0"
                  onPress={openCustomModal}
                >
                  <ButtonText className="font-bold text-white">+ Custom</ButtonText>
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
                  activePolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} deletable={isOrganizer} />
                  ))
                )}
              </VStack>
            </ScrollView>
          </View>

          {/* MIDDLE: Answered */}
          <View className="flex-1">
            <Heading size="xl" className="text-zinc-50 mb-4 mt-1">
              Answered ({answeredPolls.length})
            </Heading>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-3 pb-12">
                {answeredPolls.length === 0 ? (
                  <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
                    <Text className="text-zinc-500">No answered polls yet.</Text>
                  </Box>
                ) : (
                  answeredPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} compact />
                  ))
                )}
              </VStack>
            </ScrollView>
          </View>

          {/* RIGHT: Results / Summary */}
          <View className="flex-1">
            <Heading size="xl" className="text-zinc-50 mb-4 mt-1">Results</Heading>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack className="gap-3 pb-12">
                <SummaryView polls={polls} />
              </VStack>
            </ScrollView>
          </View>

        </View>
      </View>

      <PollModal
        visible={isModalOpen}
        initialQuestion={modalInitialQuestion}
        initialChoices={modalInitialChoices}
        eventId={id as string}
        onClose={() => setIsModalOpen(false)}
      />
    </Box>
  );
}
