import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getEventStatusLabel, isEventEnded, shouldAutoEndEvent } from '@/utils/eventStatus';
import { enqueueNotificationJob } from '@/utils/notificationJobs';
import { doc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, runTransaction, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { View, ScrollView, TouchableOpacity, useWindowDimensions, Share, Modal, Pressable, Platform, PanResponder, Animated, Easing } from 'react-native';
import { QrCode, Share as ShareIcon, Eye } from 'lucide-react-native';

type LinkedField = 'time' | 'location';
const MOBILE_EVENT_TABS = ['details', 'active', 'answered'] as const;
type EventTab = typeof MOBILE_EVENT_TABS[number];

type PollModalConfig = {
  question?: string;
  choices?: string[];
  pollIdToEdit?: string;
  linkedField?: LinkedField;
};

const EMPTY_MODAL_CONFIG: PollModalConfig = {};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getMonthGrid = (baseDate: Date): Array<{ date: Date | null; key: string }> => {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const startDay = start.getDay();
  const totalDays = end.getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];

  for (let i = 0; i < startDay; i += 1) {
    cells.push({ date: null, key: `blank-start-${i}` });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day),
      key: `day-${day}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `blank-end-${cells.length}` });
  }

  return cells;
};

const formatDateLabel = (dateKey: string) =>
  fromDateKey(dateKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const formatFullDateLabel = (dateKey: string) =>
  fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const formatHourLabel = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
};

const getAvailabilityCounts = (poll: any) => {
  const byUser = poll?.availabilityByUser || {};
  const counts: Record<string, number> = {};

  Object.values(byUser).forEach((slots) => {
    (Array.isArray(slots) ? slots : []).forEach((slotKey: string) => {
      counts[slotKey] = (counts[slotKey] || 0) + 1;
    });
  });

  return counts;
};

const getCurrentUserAvailability = (poll: any, uid?: string | null) => {
  if (!uid) return [];
  const byUser = poll?.availabilityByUser || {};
  return Array.isArray(byUser[uid]) ? byUser[uid] : [];
};

const getTopAvailabilitySlots = (poll: any, limit = 3) => {
  const counts = getAvailabilityCounts(poll);

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slotKey, count]) => {
      const [dateKey, hourString] = slotKey.split('|');
      return { slotKey, count, dateKey, hour: Number(hourString) };
    });
};

interface TimeAvailabilityModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
}

function TimeAvailabilityModal({ visible, eventId, onClose }: TimeAvailabilityModalProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const monthCells = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!visible) return;
    setCalendarMonth(new Date());
    setSelectedDates([]);
  }, [visible]);

  const toggleDate = (date: Date) => {
    const key = toDateKey(date);
    if (key < todayKey) return;

    setSelectedDates((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key].sort()
    );
  };

  const handleCreateAvailabilityPoll = async () => {
    if (selectedDates.length === 0) return;

    try {
      await addDoc(collection(db, 'events', eventId, 'polls'), {
        question: 'What time works best?',
        type: 'availability',
        selectedDates,
        startHour: 8,
        endHour: 20,
        availabilityByUser: {},
        createdAt: serverTimestamp(),
        status: 'active',
      });
      onClose();
    } catch (error) {
      console.error('Error creating availability poll:', error);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-xl max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-4">
            <VStack className="flex-1">
              <Heading size="xl" className="text-zinc-50">Select candidate dates</Heading>
              <Text className="text-zinc-400 mt-1">
                Choose the dates attendees should fill in, then they can mark available hours.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <HStack className="items-center justify-between mb-4 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
              <Text className="text-blue-400 font-semibold">Prev</Text>
            </TouchableOpacity>
            <Text className="text-zinc-50 font-bold text-lg">
              {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
              <Text className="text-blue-400 font-semibold">Next</Text>
            </TouchableOpacity>
          </HStack>

          <VStack className="gap-2">
            <HStack className="gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} className="flex-1 items-center py-2">
                  <Text className="text-zinc-500 text-xs font-bold uppercase">{label}</Text>
                </View>
              ))}
            </HStack>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {monthCells.map((cell) => {
                if (!cell.date) return <View key={cell.key} style={{ width: '13.4%', aspectRatio: 1 }} />;

                const dateKey = toDateKey(cell.date);
                const disabled = dateKey < todayKey;
                const selected = selectedDates.includes(dateKey);

                return (
                  <TouchableOpacity
                    key={cell.key}
                    disabled={disabled}
                    activeOpacity={0.8}
                    onPress={() => toggleDate(cell.date!)}
                    style={{ width: '13.4%', aspectRatio: 1 }}
                    className={`rounded-2xl border items-center justify-center ${selected ? 'bg-blue-600 border-blue-500' : 'bg-zinc-800 border-zinc-700'} ${disabled ? 'opacity-30' : ''}`}
                  >
                    <Text className={`font-semibold ${selected ? 'text-white' : 'text-zinc-200'}`}>
                      {cell.date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </VStack>

          <VStack className="mt-5 gap-2">
            <Text className="text-zinc-400 text-sm font-semibold">Selected dates</Text>
            <View className="min-h-[48px] bg-zinc-800/60 border border-zinc-700 rounded-2xl p-3">
              {selectedDates.length === 0 ? (
                <Text className="text-zinc-500">Tap dates on the calendar above.</Text>
              ) : (
                <Text className="text-zinc-200">{selectedDates.map(formatFullDateLabel).join(', ')}</Text>
              )}
            </View>
          </VStack>

          <Button
            size="xl"
            action="primary"
            className="bg-blue-600 border-0 mt-6"
            onPress={handleCreateAvailabilityPoll}
            isDisabled={selectedDates.length === 0}
          >
            <ButtonText className="font-bold text-white">Create Time Calendar</ButtonText>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

interface AvailabilityPickerModalProps {
  visible: boolean;
  poll: any | null;
  currentUid?: string | null;
  onClose: () => void;
  onSave: (pollId: string, slots: string[]) => Promise<void>;
}

function AvailabilityPickerModal({ visible, poll, currentUid, onClose, onSave }: AvailabilityPickerModalProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !poll) return;
    setSelectedSlots(getCurrentUserAvailability(poll, currentUid));
    setIsDragging(false);
  }, [visible, poll, currentUid]);

  if (!poll) return null;

  const dateKeys = Array.isArray(poll.selectedDates) ? [...poll.selectedDates].sort() : [];
  const startHour = typeof poll.startHour === 'number' ? poll.startHour : 8;
  const endHour = typeof poll.endHour === 'number' ? poll.endHour : 20;

  const mutateSlot = (slotKey: string, mode: 'add' | 'remove') => {
    setSelectedSlots((current) => {
      const hasSlot = current.includes(slotKey);
      if (mode === 'add') return hasSlot ? current : [...current, slotKey];
      return hasSlot ? current.filter((value) => value !== slotKey) : current;
    });
  };

  const handleSlotStart = (slotKey: string) => {
    const nextMode = selectedSlots.includes(slotKey) ? 'remove' : 'add';
    setDragMode(nextMode);
    setIsDragging(true);
    mutateSlot(slotKey, nextMode);
  };

  const handleSlotEnter = (slotKey: string) => {
    if (!isDragging) return;
    mutateSlot(slotKey, dragMode);
  };

  const handleSave = async () => {
    if (!poll?.id) return;

    try {
      setSaving(true);
      await onSave(poll.id, [...selectedSlots].sort());
      onClose();
    } catch (error) {
      console.error('Error saving availability:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} onPressOut={() => setIsDragging(false)} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-5xl max-h-[92%] shadow-2xl z-10">
          <HStack className="justify-between items-start mb-4 gap-4">
            <VStack className="flex-1">
              <Heading size="xl" className="text-zinc-50">Mark your availability</Heading>
              <Text className="text-zinc-400 mt-1">
                Drag across hours to mark when you&apos;re free. On touch devices, tap individual blocks.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <VStack className="gap-2 pb-2" onTouchEnd={() => setIsDragging(false)}>
              <HStack className="gap-2">
                <View style={{ width: 84 }} />
                {dateKeys.map((dateKey) => (
                  <View key={dateKey} className="bg-zinc-800 border border-zinc-700 rounded-xl py-3 items-center" style={{ width: 140 }}>
                    <Text className="text-zinc-100 font-semibold">{formatDateLabel(dateKey)}</Text>
                    <Text className="text-zinc-500 text-xs mt-1">
                      {fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' })}
                    </Text>
                  </View>
                ))}
              </HStack>

              {Array.from({ length: Math.max(endHour - startHour, 0) }).map((_, idx) => {
                const hour = startHour + idx;

                return (
                  <HStack key={hour} className="gap-2 items-center">
                    <View style={{ width: 84 }} className="pr-2 items-end">
                      <Text className="text-zinc-400 text-xs font-semibold">{formatHourLabel(hour)}</Text>
                    </View>
                    {dateKeys.map((dateKey) => {
                      const slotKey = `${dateKey}|${hour}`;
                      const selected = selectedSlots.includes(slotKey);
                      const webHandlers = Platform.OS === 'web'
                        ? {
                            onMouseDown: () => handleSlotStart(slotKey),
                            onMouseEnter: () => handleSlotEnter(slotKey),
                            onMouseUp: () => setIsDragging(false),
                          }
                        : {};

                      return (
                        <Pressable
                          key={slotKey}
                          {...(webHandlers as any)}
                          onPressIn={() => Platform.OS !== 'web' && handleSlotStart(slotKey)}
                          onPressOut={() => Platform.OS !== 'web' && setIsDragging(false)}
                          className={`rounded-xl border ${selected ? 'bg-blue-600 border-blue-500' : 'bg-zinc-800 border-zinc-700'}`}
                          style={{ width: 140, height: 42 }}
                        >
                          <View className="flex-1 items-center justify-center">
                            <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-zinc-500'}`}>
                              {selected ? 'Available' : ''}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </HStack>
                );
              })}
            </VStack>
          </ScrollView>

          <HStack className="items-center justify-between mt-5 gap-4 flex-wrap">
            <Text className="text-zinc-400">
              {selectedSlots.length} hour block{selectedSlots.length === 1 ? '' : 's'} selected
            </Text>
            <Button size="lg" action="primary" className="bg-blue-600 border-0" onPress={handleSave} isDisabled={saving}>
              <ButtonText className="font-bold text-white">Save Availability</ButtonText>
            </Button>
          </HStack>
        </View>
      </View>
    </Modal>
  );
}

interface AvailabilityPollCardProps {
  poll: any;
  currentUid?: string | null;
  compact?: boolean;
  showResults?: boolean;
  eventEnded: boolean;
  isOrganizer: boolean;
  onDelete: (poll: any) => void;
  onOpenAvailability: (poll: any) => void;
}

function AvailabilityPollCard({
  poll,
  currentUid,
  compact = false,
  showResults = false,
  eventEnded,
  isOrganizer,
  onDelete,
  onOpenAvailability,
}: AvailabilityPollCardProps) {
  const dateKeys = Array.isArray(poll.selectedDates) ? [...poll.selectedDates].sort() : [];
  const counts = getAvailabilityCounts(poll);
  const currentSelections = getCurrentUserAvailability(poll, currentUid);
  const participantCount = Object.keys(poll.availabilityByUser || {}).filter((uid) =>
    Array.isArray(poll.availabilityByUser?.[uid]) && poll.availabilityByUser[uid].length > 0
  ).length;
  const topSlots = getTopAvailabilitySlots(poll, 3);
  const startHour = typeof poll.startHour === 'number' ? poll.startHour : 8;
  const endHour = typeof poll.endHour === 'number' ? poll.endHour : 20;
  const shouldShowGrid = showResults || currentSelections.length > 0 || eventEnded;

  return (
    <VStack className={`bg-zinc-800 rounded-xl border border-zinc-700 ${compact ? 'p-4 gap-3' : 'p-5 gap-4'}`}>
      <HStack className="justify-between items-start gap-3">
        <VStack className="flex-1 gap-1">
          <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>
            {poll.question}
          </Text>
          <Text className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
            Availability Calendar
          </Text>
        </VStack>

        {isOrganizer && !eventEnded && (
          <TouchableOpacity
            onPress={() => onDelete(poll)}
            className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60"
          >
            <Text className="text-red-400 text-xs font-semibold">Delete</Text>
          </TouchableOpacity>
        )}
      </HStack>

      <VStack className="gap-3">
        <Text className="text-zinc-400 text-sm">
          Selected dates: {dateKeys.length ? dateKeys.map(formatDateLabel).join(', ') : 'None yet'}
        </Text>

        <HStack className="items-center justify-between flex-wrap gap-3">
          <Text className="text-zinc-300">
            {participantCount} attendee{participantCount === 1 ? '' : 's'} submitted availability
          </Text>

          {!eventEnded && (
            <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => onOpenAvailability(poll)}>
              <ButtonText className="font-bold text-white">
                {currentSelections.length > 0 ? 'Edit Availability' : 'Mark Availability'}
              </ButtonText>
            </Button>
          )}
        </HStack>

        {topSlots.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Most popular slots</Text>
            {topSlots.map((slot) => (
              <HStack key={slot.slotKey} className="justify-between items-center">
                <Text className="text-zinc-300">
                  {formatFullDateLabel(slot.dateKey)} at {formatHourLabel(slot.hour)}
                </Text>
                <Text className="text-blue-300 font-bold">{slot.count} free</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {shouldShowGrid && dateKeys.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <VStack className="gap-2 pb-1">
              <HStack className="gap-2">
                <View style={{ width: 70 }} />
                {dateKeys.map((dateKey) => (
                  <View key={dateKey} className="bg-zinc-900/70 rounded-lg border border-zinc-700 py-2 items-center" style={{ width: 96 }}>
                    <Text className="text-zinc-200 text-xs font-semibold">{formatDateLabel(dateKey)}</Text>
                  </View>
                ))}
              </HStack>

              {Array.from({ length: Math.max(endHour - startHour, 0) }).map((_, idx) => {
                const hour = startHour + idx;

                return (
                  <HStack key={hour} className="gap-2 items-center">
                    <View style={{ width: 70 }} className="items-end pr-2">
                      <Text className="text-zinc-500 text-[11px]">{formatHourLabel(hour)}</Text>
                    </View>
                    {dateKeys.map((dateKey) => {
                      const slotKey = `${dateKey}|${hour}`;
                      const count = counts[slotKey] || 0;
                      const selected = currentSelections.includes(slotKey);

                      return (
                        <View
                          key={slotKey}
                          className={`rounded-lg border items-center justify-center ${selected ? 'bg-blue-600/70 border-blue-500' : count > 0 ? 'bg-emerald-600/35 border-emerald-500/40' : 'bg-zinc-900/50 border-zinc-700'}`}
                          style={{ width: 96, height: 28 }}
                        >
                          <Text className={`text-[11px] font-semibold ${selected ? 'text-white' : count > 0 ? 'text-emerald-100' : 'text-zinc-600'}`}>
                            {count > 0 ? count : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </HStack>
                );
              })}
            </VStack>
          </ScrollView>
        )}
      </VStack>
    </VStack>
  );
}


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

  const [activeTab, setActiveTab] = useState<EventTab>('details');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<PollModalConfig>(EMPTY_MODAL_CONFIG);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isTimeAvailabilityModalOpen, setIsTimeAvailabilityModalOpen] = useState(false);
  const [availabilityPoll, setAvailabilityPoll] = useState<any>(null);
  const [isAvailabilityPickerOpen, setIsAvailabilityPickerOpen] = useState(false);
  const [actionPoll, setActionPoll] = useState<any>(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const quickPollSyncingRef = useRef<Record<LinkedField, string | null>>({ time: null, location: null });
  const autoEndingEventRef = useRef(false);
  const mobileTabOffset = useRef(new Animated.Value(0)).current;
  const [hasAccess, setHasAccess] = useState(false);
  const [mobileTabWidth, setMobileTabWidth] = useState(0);

  const joinLink = buildJoinLink(eventData?.joinCode);
  const mobileTabIndex = MOBILE_EVENT_TABS.indexOf(activeTab);

  const mobileTabPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > 24;
        const isMostlyHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3;
        return isHorizontalSwipe && isMostlyHorizontal;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const isMostlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
        if (!isMostlyHorizontal || Math.abs(dx) < 48) return;

        setActiveTab((currentTab) => {
          const currentIndex = MOBILE_EVENT_TABS.indexOf(currentTab);

          if (dx < 0 && currentIndex < MOBILE_EVENT_TABS.length - 1) {
            return MOBILE_EVENT_TABS[currentIndex + 1];
          }

          if (dx > 0 && currentIndex > 0) {
            return MOBILE_EVENT_TABS[currentIndex - 1];
          }

          return currentTab;
        });
      },
    })
  ).current;
  
  const openModal = (question = '', choices = ['', ''], linkedField?: LinkedField) => {
    setModalConfig({
      question,
      choices: [...choices],
      pollIdToEdit: undefined,
      linkedField,
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setModalConfig(EMPTY_MODAL_CONFIG);
    setIsModalOpen(true);
  };

  const openTimeAvailabilityModal = () => {
    setIsTimeAvailabilityModalOpen(true);
  };

  const closePollModal = () => {
    setIsModalOpen(false);
    setModalConfig(EMPTY_MODAL_CONFIG);
  };

  const openAvailabilityPicker = (poll: any) => {
    if (eventData?.identityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-amber-400 font-bold text-sm">Linked Account Required</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Link Google or email before responding to this availability calendar.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      router.push(`/link-account?next=${encodeURIComponent(`/event/${id as string}`)}`);
      return;
    }

    setAvailabilityPoll(poll);
    setIsAvailabilityPickerOpen(true);
  };
  const eventEnded = isEventEnded(eventData);

  const queueNotificationJob = async (type: 'poll_nudge' | 'role_nudge', title: string, body: string) => {
    try {
      await enqueueNotificationJob({
        eventId: id as string,
        type,
        title,
        body,
      });
    } catch (error) {
      console.error('Error queueing notification job:', error);
    }
  };

  // --- 2. The handler function you pass to your Poll components ---
  const handleNudge = async (poll: any) => {
    if (eventEnded) return;
    const itemType = getEventItemType(poll);
    await queueNotificationJob(
      itemType === 'role' ? 'role_nudge' : 'poll_nudge',
      itemType === 'role' ? 'Role still open!' : "Don't forget to vote! ?",
      itemType === 'role'
        ? `The role "${poll.question}" is still available to claim.`
        : `The poll "${poll.question}" is waiting for your response.`
    );
    trackEvent(itemType === 'role' ? 'role_nudged' : 'poll_nudged', { event_id: id as string, poll_id: poll.id });

    toast.show({
      placement: "top",
      render: ({ id: toastId }) => (
        <Toast nativeID={toastId} className="bg-zinc-800 border border-blue-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
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
            <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
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
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
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
        <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
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
    let unsubscribeParticipants: (() => void) | undefined;

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
            setIsOrganizer(data.organizerId === auth.currentUser?.uid);

            if (shouldAutoEndEvent(data)) {
              if (!autoEndingEventRef.current) {
                autoEndingEventRef.current = true;
                void updateDoc(eventRef, {
                  status: 'ended',
                  endedAt: serverTimestamp(),
                }).catch((error) => {
                  autoEndingEventRef.current = false;
                  console.error('Error auto-ending event:', error);
                });
              }
              setEventData({ ...data, status: 'ended' });
              return;
            }

            autoEndingEventRef.current = false;
            setEventData(data);
          }
          setLoading(false);
        });

        const pollsRef = collection(db, 'events', id as string, 'polls');
        const q = query(pollsRef, orderBy('createdAt', 'desc'));
        unsubscribePolls = onSnapshot(q, (snapshot) => {
          setPolls(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        const membersQuery = query(collection(db, 'events', id as string, 'members'));
        unsubscribeParticipants = onSnapshot(membersQuery, (snapshot) => {
          const nextParticipantIds = snapshot.docs
            .map((participantDoc) => participantDoc.id)
            .sort((a, b) => a.localeCompare(b));
          setParticipantIds(nextParticipantIds);
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
      if (unsubscribeParticipants) unsubscribeParticipants();
    };
  }, [id, router]);

  const getLinkedQuickPoll = (field: LinkedField) =>
    polls.find((poll) => getEventItemType(poll) === 'poll' && poll.linkedField === field);

  const getWinningOption = (poll: any) => {
    const options = Array.isArray(poll?.options) ? poll.options : [];
    if (!options.length) return null;
    const maxVotes = Math.max(...options.map((option: any) => option.voterIds.length));
    if (maxVotes <= 0) return null;
    const winners = options.filter((option: any) => option.voterIds.length === maxVotes);
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

  useEffect(() => {
    if (!isMobile || mobileTabWidth <= 0) return;

    Animated.timing(mobileTabOffset, {
      toValue: -(mobileTabIndex * mobileTabWidth),
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isMobile, mobileTabIndex, mobileTabOffset, mobileTabWidth]);

  const handleVote = async (pollId: string, selectedIndices: number | number[], currentOptions: any[], allowMultipleVotes: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (eventData?.identityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-amber-400 font-bold text-sm">Linked Account Required</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Link Google or email before voting in this event.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      router.push(`/link-account?next=${encodeURIComponent(`/event/${id as string}`)}`);
      return;
    }
    if (eventEnded) {
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Event Ended</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">This event is no longer accepting votes.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }

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

        const existingOptions = Array.isArray(pollData.options) ? pollData.options : [];
        let newOptions = existingOptions.map((opt: any) => ({ 
          ...opt, 
          voterIds: [...opt.voterIds] 
        }));

        if (newOptions.length === 0) {
          throw new Error('INVALID_OPTIONS');
        }
        
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
            <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
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
            <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-red-400 font-bold text-sm">Poll Ended</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">This poll is no longer accepting votes.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      } else if (error.message === 'INVALID_OPTIONS') {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-red-400 font-bold text-sm">Poll Unavailable</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">This poll is missing options and cannot accept votes right now.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      } else {
        console.error('Error updating vote:', error);
      }
    }
  };

  const handleAddChoice = async (pollId: string, choiceText: string) => {
    const uid = auth.currentUser?.uid;
    const trimmedChoice = choiceText.trim();
    if (!uid || !trimmedChoice) return false;
    if (eventEnded) return false;

    const pollRef = doc(db, 'events', id as string, 'polls', pollId);

    try {
      let outcome: 'added' | 'duplicate' | 'disabled' | 'expired' = 'disabled';

      await runTransaction(db, async (transaction) => {
        const pollDoc = await transaction.get(pollRef);
        if (!pollDoc.exists()) {
          throw new Error('NOT_FOUND');
        }

        const pollData = pollDoc.data();

        if (getEventItemType(pollData) !== 'poll') {
          throw new Error('INVALID_TYPE');
        }

        if (isEventItemExpired(pollData)) {
          outcome = 'expired';
          return;
        }

        if (!pollData.allowInviteeChoices) {
          outcome = 'disabled';
          return;
        }

        const normalizedChoice = trimmedChoice.toLocaleLowerCase();
        const existingOptions = Array.isArray(pollData.options) ? pollData.options : [];
        const hasDuplicate = existingOptions.some(
          (option: any) => (option?.text || '').trim().toLocaleLowerCase() === normalizedChoice
        );

        if (hasDuplicate) {
          outcome = 'duplicate';
          return;
        }

        transaction.update(pollRef, {
          options: [
            ...existingOptions,
            {
              text: trimmedChoice,
              voterIds: [],
            },
          ],
        });

        outcome = 'added';
      });

      const finalOutcome = outcome as 'added' | 'duplicate' | 'disabled' | 'expired';

      if (finalOutcome === 'added') {
        trackEvent('poll_choice_added_by_invitee', {
          event_id: id as string,
          poll_id: pollId,
        });
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-green-400 font-bold text-sm">Choice Added</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">Your option is now part of the poll.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return true;
      }

      if (finalOutcome === 'duplicate') {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-amber-400 font-bold text-sm">Already There</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">That option already exists in this poll.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return false;
      }

      if (finalOutcome === 'expired') {
        toast.show({
          placement: "top",
          render: ({ id: toastId }) => (
            <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
              <VStack>
                <ToastTitle className="text-red-400 font-bold text-sm">Poll Ended</ToastTitle>
                <ToastDescription className="text-zinc-300 text-xs mt-0.5">This poll is no longer accepting changes.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
      }

      return false;
    } catch (error) {
      console.error('Error adding invitee poll choice:', error);
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-red-400 font-bold text-sm">Could not add choice</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Please try again in a moment.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return false;
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

  const isAvailabilityPoll = (poll: any) => poll?.type === 'availability';

  const isPollExpired = (poll: any) => {
    if (isAvailabilityPoll(poll)) return false;
    return isEventItemExpired(poll);
  };

  const hasRespondedToPoll = (poll: any) => {
    if (!currentUid) return false;
    if (isAvailabilityPoll(poll)) {
      return getCurrentUserAvailability(poll, currentUid).length > 0;
    }

    return getRespondedUserIds(poll).includes(currentUid);
  };

  const handleSaveAvailability = async (pollId: string, slotKeys: string[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) return;
    if (eventEnded) return;

    if (eventData?.identityRequirement === 'linked_account' && auth.currentUser?.isAnonymous) {
      toast.show({
        placement: "top",
        render: ({ id: toastId }) => (
          <Toast nativeID={toastId} className="bg-zinc-800 border border-amber-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
            <VStack>
              <ToastTitle className="text-amber-400 font-bold text-sm">Linked Account Required</ToastTitle>
              <ToastDescription className="text-zinc-300 text-xs mt-0.5">Link Google or email before responding to this availability calendar.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      router.push(`/link-account?next=${encodeURIComponent(`/event/${id as string}`)}`);
      return;
    }

    const poll = polls.find((item) => item.id === pollId);
    const existing = poll?.availabilityByUser || {};
    await updateDoc(doc(db, 'events', id as string, 'polls', pollId), {
      availabilityByUser: {
        ...existing,
        [uid]: [...slotKeys].sort(),
      },
    });
  };

  const activePolls = polls.filter((poll) => {
    if (eventEnded) return false;
    return !hasRespondedToPoll(poll) && !isPollExpired(poll);
  });
  const answeredPolls = polls.filter((poll) => {
    if (eventEnded) return true;
    return hasRespondedToPoll(poll) || isPollExpired(poll);
  });

  const roleAssignments = polls.reduce<Record<string, string[]>>((acc, poll) => {
    if (getEventItemType(poll) === 'role') {
      getRespondedUserIds(poll).forEach((uid) => {
        acc[uid] = [...(acc[uid] || []), poll.question];
      });
    }

    return acc;
  }, {});
  const headcount = participantIds.length;
  const timeQuickPoll = getLinkedQuickPoll('time');
  const locationQuickPoll = getLinkedQuickPoll('location');

  const renderDetailValue = (field: LinkedField) => {
    const currentValue = eventData?.[field];
    if (currentValue) {
      return <Text className="text-zinc-50 text-lg font-semibold">{currentValue}</Text>;
    }

    if (!isOrganizer || eventEnded) {
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

  const renderDetailsTab = () => (
    <VStack className="gap-4 mt-1">
      <VStack className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-700/50 gap-4">
        <VStack>
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Status</Text>
          <Text className={`text-lg font-bold ${eventData?.status === 'voting' ? 'text-green-400' : 'text-red-300'}`}>
            {eventData?.status === 'voting' ? 'Active Voting' : getEventStatusLabel(eventData)}
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
        <VStack className="gap-3">
          <Button 
            size="xl" 
            variant="outline" 
            className="border-zinc-600 bg-zinc-800" 
            onPress={() => router.push(`/edit/${id as string}`)}
          >
            <ButtonText className="font-bold text-zinc-50">Edit Event Details</ButtonText>
          </Button>
        </VStack>
      )}
    </VStack>
  );

  const renderPollItem = (poll: any, answered = false) => {
    if (isAvailabilityPoll(poll)) {
      return (
        <AvailabilityPollCard
          key={poll.id}
          poll={poll}
          compact={answered}
          showResults={answered}
          currentUid={currentUid}
          eventEnded={eventEnded}
          isOrganizer={isOrganizer}
          onDelete={handleDeletePoll}
          onOpenAvailability={openAvailabilityPicker}
        />
      );
    }

    return (
      <PollCard
        key={poll.id}
        poll={poll}
        compact={answered}
        showResults={answered}
        isOrganizer={isOrganizer && !eventEnded}
        currentUid={currentUid}
        onVote={handleVote}
        onAddChoice={handleAddChoice}
        onActionPress={setActionPoll}
      />
    );
  };

  const renderCreateActions = (compact = false) => (
    <VStack className={compact ? 'gap-3' : 'gap-2'}>
      <Button
        size={compact ? 'md' : 'sm'}
        action="primary"
        className="bg-blue-600 border-0"
        onPress={() => {
          trackEvent('item_create_started', { event_id: id as string });
          openCreateModal();
        }}
      >
        <ButtonText className="font-bold text-white">{compact ? '+ Create Poll or Role' : '+ New'}</ButtonText>
      </Button>

      <Button
        size={compact ? 'md' : 'sm'}
        variant="outline"
        className="border-zinc-600 bg-zinc-800"
        onPress={openTimeAvailabilityModal}
      >
        <ButtonText className="font-bold text-zinc-50">{compact ? 'Create Time Calendar' : 'Time Calendar'}</ButtonText>
      </Button>
    </VStack>
  );

  const renderActiveTab = () => (
    activePolls.length === 0 ? (
      <EmptyState message="You're all caught up!" />
    ) : (
      activePolls.map((poll) => renderPollItem(poll))
    )
  );

  const renderAnsweredTab = () => (
    answeredPolls.length === 0 ? (
      <EmptyState message="No answered polls yet." />
    ) : (
      answeredPolls.map((poll) => renderPollItem(poll, true))
    )
  );

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
                <ButtonText className="text-blue-500">? Dashboard</ButtonText>
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
              {MOBILE_EVENT_TABS.map((tab) => (
                <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-zinc-600' : ''}`}>
                  <Text className={`text-xs font-semibold ${activeTab === tab ? 'text-zinc-50' : 'text-zinc-400'}`}>
                    {tab === 'details' ? 'Details' : tab === 'active' ? 'Active' : 'Results'}
                  </Text>
                </TouchableOpacity>
              ))}
            </HStack>

            {/* --- CREATE BUTTON (Only on Active tab) --- */}
            {isOrganizer && !eventEnded && activeTab === 'active' && (
              <View className="mb-4">
                {renderCreateActions(true)}
              </View>
            )}

            {/* --- TAB CONTENT --- */}
            <View
              className="flex-1 overflow-hidden"
              onLayout={(event) => {
                const nextWidth = Math.round(event.nativeEvent.layout.width);
                if (!nextWidth || nextWidth === mobileTabWidth) return;
                setMobileTabWidth(nextWidth);
              }}
              {...mobileTabPanResponder.panHandlers}
            >
              <Animated.View
                className="flex-1 flex-row"
                style={{
                  width: (mobileTabWidth || Math.max(width - 32, 1)) * MOBILE_EVENT_TABS.length,
                  transform: [{ translateX: mobileTabOffset }],
                }}
              >
                <View style={{ width: mobileTabWidth || Math.max(width - 32, 1) }} className="flex-1">
                  <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <VStack className="gap-4 pb-12">
                      {renderDetailsTab()}
                    </VStack>
                  </ScrollView>
                </View>

                <View style={{ width: mobileTabWidth || Math.max(width - 32, 1) }} className="flex-1">
                  <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <VStack className="gap-4 pb-12">
                      {renderActiveTab()}
                    </VStack>
                  </ScrollView>
                </View>

                <View style={{ width: mobileTabWidth || Math.max(width - 32, 1) }} className="flex-1">
                  <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <VStack className="gap-4 pb-12">
                      {renderAnsweredTab()}
                    </VStack>
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </>
        ) : (
          /* --- DESKTOP VIEW --- */
          <View className="flex-1 flex-col md:flex-row gap-8 w-full pb-6">
            <View className="flex-1">
              <HStack className="justify-between items-end mb-4 mt-1">
                <Heading size="xl" className="text-zinc-50">Active</Heading>
                {isOrganizer && !eventEnded && (
                  renderCreateActions()
                )}
              </HStack>
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <VStack className="gap-4 pb-12">
                  {activePolls.length === 0 ? (
                    <EmptyState message="You're all caught up!" />
                  ) : (
                    activePolls.map((poll) => renderPollItem(poll))
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
                    answeredPolls.map((poll) => renderPollItem(poll, true))
                  )}
                </VStack>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <QRModal visible={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} eventData={eventData} joinLink={joinLink} />
      <PollModal visible={isModalOpen} eventId={id as string} onClose={closePollModal} initialQuestion={modalConfig.question} initialChoices={modalConfig.choices} pollIdToEdit={modalConfig.pollIdToEdit} linkedField={modalConfig.linkedField} />
      <TimeAvailabilityModal visible={isTimeAvailabilityModalOpen} eventId={id as string} onClose={() => setIsTimeAvailabilityModalOpen(false)} />
      <AvailabilityPickerModal
        visible={isAvailabilityPickerOpen}
        poll={availabilityPoll}
        currentUid={currentUid}
        onClose={() => {
          setIsAvailabilityPickerOpen(false);
          setAvailabilityPoll(null);
        }}
        onSave={handleSaveAvailability}
      />
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
        participantIds={participantIds}
        roleAssignments={roleAssignments}
        organizerId={eventData?.organizerId}
        eventId={id as string}
      />
    </Box>
  );
}
