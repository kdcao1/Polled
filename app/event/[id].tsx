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
import { completeAnalyticsJourney, ensureAnalyticsJourneyStarted, incrementAnalyticsCounter, trackEvent, trackEventOnce } from '@/utils/analytics';
import { getEventItemType, getRespondedUserIds, getResponseCount, isEventItemExpired } from '@/utils/eventItems';
import { getEventStatusLabel, isEventEnded, shouldAutoEndEvent } from '@/utils/eventStatus';
import { enqueueNotificationJob } from '@/utils/notificationJobs';
import { doc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, runTransaction, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { View, ScrollView, TouchableOpacity, useWindowDimensions, Share, Modal, Pressable, Platform, PanResponder, Animated, Easing } from 'react-native';
import { QrCode, Share as ShareIcon, Eye } from 'lucide-react-native';

type LinkedField = 'time' | 'location';
type AvailabilityPollMode = 'date' | 'time';
const MOBILE_EVENT_TABS = ['details', 'active', 'answered'] as const;
type EventTab = typeof MOBILE_EVENT_TABS[number];

type PollModalConfig = {
  question?: string;
  choices?: string[];
  pollIdToEdit?: string;
  linkedField?: LinkedField;
  initialEditState?: {
    createType: 'poll' | 'role';
    allowMultiple: boolean;
    allowInviteeChoices: boolean;
    endCondition: 'time' | 'vote_count';
    targetVoteCount: string;
    slotLimitMode: 'limited' | 'unlimited';
    slotLimit: string;
  };
};

const EMPTY_MODAL_CONFIG: PollModalConfig = {};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_AVAILABILITY_START_HOUR = 7;
const DEFAULT_AVAILABILITY_END_HOUR = 30;
const DEFAULT_AVAILABILITY_STAGE_DURATION_HOURS = 24;
const DEFAULT_DATE_AVAILABILITY_WINDOW_DAYS = 45;
const MAX_PROMOTED_DATES = 7;

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
  const normalizedHour = ((hour % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const normalized = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${normalized}:00 ${suffix}`;
};

const formatDateTimeSlotLabel = (dateKey: string, hour: number) =>
  `${formatFullDateLabel(dateKey)} at ${formatHourLabel(hour)}`;

const createFutureDateKeys = (dayCount = DEFAULT_DATE_AVAILABILITY_WINDOW_DAYS) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + index);
    return toDateKey(nextDate);
  });
};

const getAvailabilityMode = (poll: any): AvailabilityPollMode =>
  poll?.availabilityMode === 'date' ? 'date' : 'time';

const isDateAvailabilityKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

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
    .filter(([slotKey]) => slotKey.includes('|'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slotKey, count]) => {
      const [dateKey, hourString] = slotKey.split('|');
      return { slotKey, count, dateKey, hour: Number(hourString) };
    });
};

const getTopAvailabilityDates = (poll: any, limit = 3) => {
  const counts = getAvailabilityCounts(poll);

  return Object.entries(counts)
    .filter(([dateKey]) => isDateAvailabilityKey(dateKey))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([dateKey, count]) => ({ dateKey, count }));
};

const getAvailabilityExpiresAtDate = (poll: any) => {
  if (!poll?.expiresAt) return null;
  return poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt);
};

const getAvailabilityHourBounds = (poll: any) => {
  const startHour =
    typeof poll?.startHour === 'number'
      ? Math.min(poll.startHour, DEFAULT_AVAILABILITY_START_HOUR)
      : DEFAULT_AVAILABILITY_START_HOUR;
  const rawEndHour =
    typeof poll?.endHour === 'number'
      ? poll.endHour
      : DEFAULT_AVAILABILITY_END_HOUR;

  return {
    startHour,
    endHour: Math.max(rawEndHour, DEFAULT_AVAILABILITY_END_HOUR),
  };
};

interface TimeAvailabilityModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
}

function TimeAvailabilityModal({ visible, eventId, onClose }: TimeAvailabilityModalProps) {
  const MAX_SELECTED_DATES = 7;
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

    setSelectedDates((current) => {
      if (current.includes(key)) {
        return current.filter((value) => value !== key);
      }

      if (current.length >= MAX_SELECTED_DATES) {
        return current;
      }

      return [...current, key].sort();
    });
  };

  const handleCreateAvailabilityPoll = async () => {
    if (selectedDates.length === 0) return;

    try {
      await addDoc(collection(db, 'events', eventId, 'polls'), {
        question: 'What times work best?',
        type: 'availability',
        availabilityMode: 'time',
        linkedField: 'time',
        selectedDates,
        startHour: DEFAULT_AVAILABILITY_START_HOUR,
        endHour: DEFAULT_AVAILABILITY_END_HOUR,
        availabilityByUser: {},
        createdAt: serverTimestamp(),
        status: 'active',
        expiresAt: new Date(Date.now() + DEFAULT_AVAILABILITY_STAGE_DURATION_HOURS * 60 * 60 * 1000),
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
                Choose up to 7 dates for attendees to fill in, then they can mark available hours.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <HStack className="items-center justify-between mb-4 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
              <Text className="text-emerald-400 font-semibold">Prev</Text>
            </TouchableOpacity>
            <Text className="text-zinc-50 font-bold text-lg">
              {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
              <Text className="text-emerald-400 font-semibold">Next</Text>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCells.map((cell) => {
                const cellStyle = { width: '14.2857%' as const, aspectRatio: 1, padding: 4 };
                if (!cell.date) return <View key={cell.key} style={cellStyle} />;

                const dateKey = toDateKey(cell.date);
                const disabled = dateKey < todayKey;
                const selected = selectedDates.includes(dateKey);

                return (
                  <View key={cell.key} style={cellStyle}>
                    <TouchableOpacity
                      disabled={disabled}
                      activeOpacity={0.8}
                      onPress={() => toggleDate(cell.date!)}
                      className={`flex-1 rounded-2xl border items-center justify-center ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-800 border-zinc-700'} ${disabled ? 'opacity-30' : ''}`}
                    >
                      <Text className={`font-semibold ${selected ? 'text-white' : 'text-zinc-200'}`}>
                        {cell.date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </VStack>

          <Button
            size="xl"
            action="primary"
            className="bg-emerald-600 border-0 mt-6"
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

interface TimePollModeModalProps {
  visible: boolean;
  onClose: () => void;
  onChooseInviteesDecideDates: () => void;
  onChooseCreatorSelectsDates: () => void;
  onChooseManual: () => void;
}

function TimePollModeModal({
  visible,
  onClose,
  onChooseInviteesDecideDates,
  onChooseCreatorSelectsDates,
  onChooseManual,
}: TimePollModeModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-lg shadow-2xl z-10">
          <HStack className="justify-between items-center mb-4">
            <VStack className="flex-1 gap-1">
              <Heading size="xl" className="text-zinc-50">Choose a time flow</Heading>
              <Text className="text-zinc-400">
                Pick how the group should decide the final event time.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <VStack className="gap-3">
            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-2xl border border-emerald-500 bg-emerald-500/10 p-4"
              onPress={onChooseInviteesDecideDates}
            >
              <Text className="text-emerald-300 font-bold text-lg">Invitees decide dates first</Text>
              <Text className="text-zinc-300 text-sm mt-1">
                Open a date-availability poll across the next 45 days. When it ends, the top 7 dates automatically become a time-availability poll.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-2xl border border-blue-500 bg-blue-500/10 p-4"
              onPress={onChooseCreatorSelectsDates}
            >
              <Text className="text-blue-300 font-bold text-lg">I&apos;ll choose the candidate dates</Text>
              <Text className="text-zinc-300 text-sm mt-1">
                Use the current calendar flow where you pick up to 7 dates and invitees submit the hours they are free.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-2xl border border-zinc-700 bg-zinc-800 p-4"
              onPress={onChooseManual}
            >
              <Text className="text-zinc-100 font-bold text-lg">Set an exact date and time manually</Text>
              <Text className="text-zinc-400 text-sm mt-1">
                Skip polling and jump straight to editing the event details yourself.
              </Text>
            </TouchableOpacity>
          </VStack>
        </View>
      </View>
    </Modal>
  );
}

interface DateAvailabilityPickerModalProps {
  visible: boolean;
  poll: any | null;
  currentUid?: string | null;
  onClose: () => void;
  onSave: (pollId: string, slots: string[]) => Promise<void>;
}

function DateAvailabilityPickerModal({
  visible,
  poll,
  currentUid,
  onClose,
  onSave,
}: DateAvailabilityPickerModalProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const availableDateKeys = Array.isArray(poll?.availableDateKeys) ? [...poll.availableDateKeys].sort() : [];
  const allowedDates = useMemo(() => new Set(availableDateKeys), [availableDateKeys]);
  const firstDateKey = availableDateKeys[0] ?? toDateKey(new Date());
  const lastDateKey = availableDateKeys[availableDateKeys.length - 1] ?? firstDateKey;
  const firstDate = fromDateKey(firstDateKey);
  const lastDate = fromDateKey(lastDateKey);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
  const monthCells = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);
  const minMonthValue = firstDate.getFullYear() * 12 + firstDate.getMonth();
  const maxMonthValue = lastDate.getFullYear() * 12 + lastDate.getMonth();
  const currentMonthValue = calendarMonth.getFullYear() * 12 + calendarMonth.getMonth();

  useEffect(() => {
    if (!visible || !poll) return;
    setSelectedDates(getCurrentUserAvailability(poll, currentUid));
    setCalendarMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
  }, [visible, poll, currentUid, firstDateKey]);

  if (!poll) return null;

  const toggleDate = (dateKey: string) => {
    if (!allowedDates.has(dateKey)) return;

    setSelectedDates((current) =>
      current.includes(dateKey)
        ? current.filter((value) => value !== dateKey)
        : [...current, dateKey].sort()
    );
  };

  const handleSave = async () => {
    if (!poll?.id) return;

    await onSave(poll.id, [...selectedDates].sort());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-xl max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-start mb-4 gap-4">
            <VStack className="flex-1 gap-1">
              <Heading size="xl" className="text-zinc-50">Pick the dates you can do</Heading>
              <Text className="text-zinc-400">
                Choose every day that works for you. The top 7 dates will advance to the time poll.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <HStack className="items-center justify-between mb-4 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
            <TouchableOpacity
              disabled={currentMonthValue <= minMonthValue}
              onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            >
              <Text className={`font-semibold ${currentMonthValue <= minMonthValue ? 'text-zinc-600' : 'text-emerald-400'}`}>Prev</Text>
            </TouchableOpacity>
            <Text className="text-zinc-50 font-bold text-lg">
              {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>
            <TouchableOpacity
              disabled={currentMonthValue >= maxMonthValue}
              onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            >
              <Text className={`font-semibold ${currentMonthValue >= maxMonthValue ? 'text-zinc-600' : 'text-emerald-400'}`}>Next</Text>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCells.map((cell) => {
                const cellStyle = { width: '14.2857%' as const, aspectRatio: 1, padding: 4 };
                if (!cell.date) return <View key={cell.key} style={cellStyle} />;

                const dateKey = toDateKey(cell.date);
                const disabled = !allowedDates.has(dateKey);
                const selected = selectedDates.includes(dateKey);

                return (
                  <View key={cell.key} style={cellStyle}>
                    <TouchableOpacity
                      disabled={disabled}
                      activeOpacity={0.8}
                      onPress={() => toggleDate(dateKey)}
                      className={`flex-1 rounded-2xl border items-center justify-center ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-800 border-zinc-700'} ${disabled ? 'opacity-25' : ''}`}
                    >
                      <Text className={`font-semibold ${selected ? 'text-white' : 'text-zinc-200'}`}>
                        {cell.date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </VStack>

          <VStack className="gap-3 mt-5">
            <Text className="text-zinc-300 text-sm">
              {selectedDates.length === 0
                ? `No dates selected yet. Window: ${formatDateLabel(firstDateKey)} to ${formatDateLabel(lastDateKey)}`
                : `${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'} selected`}
            </Text>

            {selectedDates.length > 0 && (
              <Text className="text-zinc-500 text-xs">
                {selectedDates.map(formatDateLabel).join(', ')}
              </Text>
            )}
          </VStack>

          <Button
            size="xl"
            action="primary"
            className="bg-emerald-600 border-0 mt-6"
            onPress={handleSave}
          >
            <ButtonText className="font-bold text-white">Save Available Dates</ButtonText>
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
  const MOBILE_SLOT_HEIGHT = 46;
  const MOBILE_SLOT_GAP = 8;
  const MOBILE_SLOT_WIDTH = '86%';
  const { width } = useWindowDimensions();
  const isMobilePicker = width < 768;
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const [saving, setSaving] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const lastDraggedSlotRef = useRef<string | null>(null);
  const mobileDragStartedRef = useRef(false);
  const mobileDragStartIndexRef = useRef<number | null>(null);
  const mobileDragStartPageYRef = useRef<number | null>(null);
  const dateKeys = Array.isArray(poll?.selectedDates) ? [...poll.selectedDates].sort() : [];
  const { startHour, endHour } = getAvailabilityHourBounds(poll);
  const currentDateKey = dateKeys[currentDateIndex];
  const hours = Array.from({ length: Math.max(endHour - startHour, 0) }, (_, idx) => startHour + idx);

  useEffect(() => {
    if (!visible || !poll) return;
    setSelectedSlots(getCurrentUserAvailability(poll, currentUid));
    setIsDragging(false);
    setCurrentDateIndex(0);
  }, [visible, poll, currentUid]);

  useEffect(() => {
    if (dateKeys.length === 0) {
      setCurrentDateIndex(0);
      return;
    }

    setCurrentDateIndex((current) => Math.min(current, dateKeys.length - 1));
  }, [dateKeys.length]);

  const mutateSlot = (slotKey: string, mode: 'add' | 'remove') => {
    setSelectedSlots((current) => {
      const hasSlot = current.includes(slotKey);
      if (mode === 'add') return hasSlot ? current : [...current, slotKey];
      return hasSlot ? current.filter((value) => value !== slotKey) : current;
    });
  };

  const toggleSlot = (slotKey: string) => {
    setSelectedSlots((current) =>
      current.includes(slotKey)
        ? current.filter((value) => value !== slotKey)
        : [...current, slotKey]
    );
  };

  const handleSlotStart = (slotKey: string, slotIndex?: number, pageY?: number) => {
    const nextMode = selectedSlots.includes(slotKey) ? 'remove' : 'add';
    setDragMode(nextMode);
    setIsDragging(true);
    mobileDragStartedRef.current = true;
    lastDraggedSlotRef.current = slotKey;
    mobileDragStartIndexRef.current = slotIndex ?? null;
    mobileDragStartPageYRef.current = pageY ?? null;
    mutateSlot(slotKey, nextMode);
  };

  const handleSlotEnter = (slotKey: string) => {
    if (!isDragging) return;
    if (lastDraggedSlotRef.current === slotKey) return;
    lastDraggedSlotRef.current = slotKey;
    mutateSlot(slotKey, dragMode);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    lastDraggedSlotRef.current = null;
    mobileDragStartedRef.current = false;
    mobileDragStartIndexRef.current = null;
    mobileDragStartPageYRef.current = null;
  };

  const handleMobileSlotMove = (moveY: number) => {
    if (!isDragging || !currentDateKey) return;
    if (mobileDragStartIndexRef.current == null || mobileDragStartPageYRef.current == null) return;

    const step = MOBILE_SLOT_HEIGHT + MOBILE_SLOT_GAP;
    const delta = moveY - mobileDragStartPageYRef.current;
    const offset = Math.round(delta / step);
    const index = Math.min(
      Math.max(mobileDragStartIndexRef.current + offset, 0),
      hours.length - 1
    );

    const slotKey = `${currentDateKey}|${hours[index]}`;
    handleSlotEnter(slotKey);
  };

  const availabilityPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => isDragging && Math.abs(gestureState.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => isDragging && Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => handleMobileSlotMove(gestureState.moveY),
      onPanResponderRelease: handleDragEnd,
      onPanResponderTerminate: handleDragEnd,
    }),
    [isDragging, currentDateKey, hours, dragMode]
  );

  if (!poll) return null;

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
        <View className={`bg-zinc-900 rounded-3xl border border-zinc-800 w-full shadow-2xl z-10 ${isMobilePicker ? 'max-w-md max-h-[88%] px-4 py-5' : 'max-w-5xl max-h-[92%] p-6'}`}>
          <HStack className="justify-between items-start mb-4 gap-4">
            <VStack className="flex-1">
              <Heading size="xl" className="text-zinc-50">Mark your availability</Heading>
              {!isMobilePicker && (
                <Text className="text-zinc-400 mt-1">
                  Drag across hours to mark when you&apos;re free. On touch devices, tap individual blocks.
                </Text>
              )}
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          {isMobilePicker ? (
            <VStack className="gap-4">
              {currentDateKey ? (
                <VStack className="items-center gap-1">
                  <Text className="text-zinc-50 font-semibold">{formatDateLabel(currentDateKey)}</Text>
                  <Text className="text-zinc-500 text-xs">
                    {fromDateKey(currentDateKey).toLocaleDateString(undefined, { weekday: 'short' })} • {currentDateIndex + 1} of {Math.max(dateKeys.length, 1)}
                  </Text>
                </VStack>
              ) : null}

              <ScrollView
                className="w-full"
                style={{ maxHeight: 340 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isDragging}
              >
                <View
                  className="pb-1"
                  {...availabilityPanResponder.panHandlers}
                >
                  {hours.map((hour, index) => {
                    const slotKey = `${currentDateKey}|${hour}`;
                    const selected = selectedSlots.includes(slotKey);

                    return (
                      <Pressable
                        key={slotKey}
                        delayLongPress={120}
                        onLongPress={(event) => handleSlotStart(slotKey, index, event.nativeEvent.pageY)}
                        onPress={() => {
                          if (mobileDragStartedRef.current) {
                            mobileDragStartedRef.current = false;
                            return;
                          }
                          toggleSlot(slotKey);
                        }}
                        className={`self-center rounded-3xl border px-4 ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-800 border-zinc-700'}`}
                        style={{
                          width: MOBILE_SLOT_WIDTH,
                          height: MOBILE_SLOT_HEIGHT,
                          marginBottom: index === hours.length - 1 ? 0 : MOBILE_SLOT_GAP,
                        }}
                      >
                        <View className="flex-1 items-center justify-center">
                          <Text className={`text-base font-semibold text-center ${selected ? 'text-white' : 'text-zinc-200'}`}>
                            {formatHourLabel(hour)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </VStack>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <VStack className="gap-2 pb-2" onTouchEnd={handleDragEnd}>
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

                {hours.map((hour) => (
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
                            onMouseUp: handleDragEnd,
                          }
                        : {};

                      return (
                        <Pressable
                          key={slotKey}
                          {...(webHandlers as any)}
                          onPressIn={() => Platform.OS !== 'web' && handleSlotStart(slotKey)}
                          onPressOut={() => Platform.OS !== 'web' && handleDragEnd()}
                          className={`rounded-xl border ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-800 border-zinc-700'}`}
                          style={{ width: 140, height: 42 }}
                        >
                          <View className="flex-1 items-center justify-center" />
                        </Pressable>
                      );
                    })}
                  </HStack>
                ))}
              </VStack>
            </ScrollView>
          )}

          {isMobilePicker ? (
            <VStack className="pt-3 gap-2">
              <Text className="text-center text-zinc-500 text-xs">
                Hold and drag to select multiple
              </Text>
              <HStack className="items-center justify-between gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 border-zinc-700 bg-zinc-800"
                  onPress={() => setCurrentDateIndex((current) => Math.max(current - 1, 0))}
                  isDisabled={currentDateIndex === 0}
                >
                  <ButtonText className={currentDateIndex === 0 ? 'font-bold text-zinc-600' : 'font-bold text-zinc-200'}>
                    Back
                  </ButtonText>
                </Button>
                <Button
                  size="lg"
                  action="primary"
                  className="flex-1 bg-emerald-600 border-0"
                  onPress={
                    currentDateIndex >= dateKeys.length - 1
                      ? handleSave
                      : () => setCurrentDateIndex((current) => Math.min(current + 1, Math.max(dateKeys.length - 1, 0)))
                  }
                  isDisabled={saving}
                >
                  <ButtonText className="font-bold text-white">
                    {currentDateIndex >= dateKeys.length - 1 ? 'Submit' : 'Forward'}
                  </ButtonText>
                </Button>
              </HStack>
            </VStack>
          ) : (
            <HStack className="items-center justify-center mt-4">
              <Button size="lg" action="primary" className="bg-emerald-600 border-0 self-center" onPress={handleSave} isDisabled={saving}>
                <ButtonText className="font-bold text-white">Save Availability</ButtonText>
              </Button>
            </HStack>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface FinalTimeSelectionModalProps {
  visible: boolean;
  poll: any | null;
  onClose: () => void;
  onSelectSlot: (poll: any, slotKey: string) => Promise<void>;
}

function FinalTimeSelectionModal({
  visible,
  poll,
  onClose,
  onSelectSlot,
}: FinalTimeSelectionModalProps) {
  const [savingSlotKey, setSavingSlotKey] = useState<string | null>(null);
  const winningSlots = Array.isArray(poll?.tiedSlotKeys) ? poll.tiedSlotKeys : [];
  const counts = getAvailabilityCounts(poll);

  if (!poll) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-lg shadow-2xl z-10">
          <HStack className="justify-between items-start mb-4 gap-4">
            <VStack className="flex-1 gap-1">
              <Heading size="xl" className="text-zinc-50">Choose the final time</Heading>
              <Text className="text-zinc-400">
                The time poll ended in a tie. Pick the winner from the top slots below.
              </Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </HStack>

          <VStack className="gap-3">
            {winningSlots.map((slotKey: string) => {
              const [dateKey, hourString] = slotKey.split('|');
              const hour = Number(hourString);

              return (
                <Button
                  key={slotKey}
                  size="xl"
                  variant="outline"
                  className="border-zinc-700 bg-zinc-800 justify-start"
                  onPress={async () => {
                    setSavingSlotKey(slotKey);
                    try {
                      await onSelectSlot(poll, slotKey);
                      onClose();
                    } finally {
                      setSavingSlotKey(null);
                    }
                  }}
                  isDisabled={savingSlotKey !== null}
                >
                  <ButtonText className="text-left text-zinc-50 font-bold">
                    {savingSlotKey === slotKey ? 'Saving...' : `${formatDateTimeSlotLabel(dateKey, hour)} (${counts[slotKey] || 0} free)`}
                  </ButtonText>
                </Button>
              );
            })}
          </VStack>
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
  onResolveTie?: (poll: any) => void;
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
  onResolveTie,
}: AvailabilityPollCardProps) {
  const availabilityMode = getAvailabilityMode(poll);
  const isDateStage = availabilityMode === 'date';
  const isAwaitingSelection = poll?.status === 'awaiting_selection';
  const isEnded = poll?.status === 'ended';
  const isActive = poll?.status === 'active';
  const dateKeys = isDateStage
    ? (Array.isArray(poll.availableDateKeys) ? [...poll.availableDateKeys].sort() : [])
    : (Array.isArray(poll.selectedDates) ? [...poll.selectedDates].sort() : []);
  const counts = getAvailabilityCounts(poll);
  const currentSelections = getCurrentUserAvailability(poll, currentUid);
  const participantCount = Object.keys(poll.availabilityByUser || {}).filter((uid) =>
    Array.isArray(poll.availabilityByUser?.[uid]) && poll.availabilityByUser[uid].length > 0
  ).length;
  const topSlots = getTopAvailabilitySlots(poll, 3);
  const topDates = getTopAvailabilityDates(poll, 3);
  const promotedDates = Array.isArray(poll.winningDateKeys) ? poll.winningDateKeys : [];
  const { startHour, endHour } = getAvailabilityHourBounds(poll);
  const shouldShowGrid = !isDateStage && (currentSelections.length > 0 || eventEnded || isEnded || isAwaitingSelection || showResults);
  const cardLabel = isDateStage ? 'Date Availability' : 'Time Availability';
  const statusText = isAwaitingSelection
    ? 'Organizer choosing winner'
    : isEnded
      ? 'Ended'
      : isDateStage
        ? 'Collecting dates'
        : 'Collecting times';

  return (
    <VStack className={`bg-zinc-800 rounded-xl border border-zinc-700 ${compact ? 'p-4 gap-3' : 'p-5 gap-4'}`}>
      <HStack className="justify-between items-start gap-3">
        <VStack className="flex-1 gap-1">
          <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>
            {poll.question}
          </Text>
          <Text className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            {cardLabel}
          </Text>
          <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">
            {statusText}
          </Text>
        </VStack>

        {isOrganizer && !eventEnded && isActive && (
          <TouchableOpacity
            onPress={() => onDelete(poll)}
            className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60"
          >
            <Text className="text-red-400 text-xs font-semibold">Delete</Text>
          </TouchableOpacity>
        )}
      </HStack>

      <VStack className="gap-3">
        {isDateStage ? (
          <Text className="text-zinc-400 text-sm">
            Date window: {dateKeys.length ? `${formatDateLabel(dateKeys[0])} to ${formatDateLabel(dateKeys[dateKeys.length - 1])}` : 'None yet'}
          </Text>
        ) : (
          <Text className="text-zinc-400 text-sm">
            Selected dates: {dateKeys.length ? dateKeys.map(formatDateLabel).join(', ') : 'None yet'}
          </Text>
        )}

        <HStack className="items-center justify-between flex-wrap gap-3">
          <Text className="text-zinc-300">
            {participantCount} attendee{participantCount === 1 ? '' : 's'} submitted availability
          </Text>

          {!eventEnded && isActive && (
            <Button size="sm" action="primary" className="bg-emerald-600 border-0" onPress={() => onOpenAvailability(poll)}>
              <ButtonText className="font-bold text-white">
                {currentSelections.length > 0
                  ? (isDateStage ? 'Edit Dates' : 'Edit Availability')
                  : (isDateStage ? 'Pick Dates' : 'Mark Availability')}
              </ButtonText>
            </Button>
          )}

          {!eventEnded && isAwaitingSelection && isOrganizer && onResolveTie && (
            <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => onResolveTie(poll)}>
              <ButtonText className="font-bold text-white">Choose Final Time</ButtonText>
            </Button>
          )}
        </HStack>

        {isDateStage && topDates.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Most popular dates</Text>
            {topDates.map((date) => (
              <HStack key={date.dateKey} className="justify-between items-center">
                <Text className="text-zinc-300">{formatFullDateLabel(date.dateKey)}</Text>
                <Text className="text-emerald-300 font-bold">{date.count} free</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {!isDateStage && topSlots.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Most popular slots</Text>
            {topSlots.map((slot) => (
              <HStack key={slot.slotKey} className="justify-between items-center">
                <Text className="text-zinc-300">
                  {formatDateTimeSlotLabel(slot.dateKey, slot.hour)}
                </Text>
                <Text className="text-emerald-300 font-bold">{slot.count} free</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {isDateStage && currentSelections.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/40 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Your dates</Text>
            <Text className="text-zinc-400 text-sm">{currentSelections.map(formatDateLabel).join(', ')}</Text>
          </VStack>
        )}

        {isDateStage && promotedDates.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/40 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Advanced to the time poll</Text>
            <Text className="text-zinc-400 text-sm">{promotedDates.map(formatDateLabel).join(', ')}</Text>
          </VStack>
        )}

        {isAwaitingSelection && Array.isArray(poll.tiedSlotKeys) && poll.tiedSlotKeys.length > 0 && (
          <VStack className="gap-2 bg-zinc-900/40 border border-zinc-700 rounded-xl p-4">
            <Text className="text-zinc-200 font-semibold">Final tied slots</Text>
            {poll.tiedSlotKeys.map((slotKey: string) => {
              const [dateKey, hourString] = slotKey.split('|');
              return (
                <Text key={slotKey} className="text-zinc-400 text-sm">
                  {formatDateTimeSlotLabel(dateKey, Number(hourString))}
                </Text>
              );
            })}
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
                          className={`rounded-lg border items-center justify-center ${selected ? 'bg-emerald-600/70 border-emerald-500' : count > 0 ? 'bg-emerald-600/35 border-emerald-500/40' : 'bg-zinc-900/50 border-zinc-700'}`}
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
  const params = useLocalSearchParams();
  const { id } = params;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const toast = useToast();
  const currentUid = auth.currentUser?.uid;
  const initialEventData =
    typeof params.title === 'string' ||
    typeof params.time === 'string' ||
    typeof params.location === 'string' ||
    typeof params.status === 'string' ||
    typeof params.joinCode === 'string' ||
    typeof params.organizerId === 'string'
      ? {
          title: typeof params.title === 'string' ? params.title : '',
          time: typeof params.time === 'string' ? params.time : '',
          location: typeof params.location === 'string' ? params.location : '',
          status: params.status === 'ended' ? 'ended' : 'voting',
          joinCode: typeof params.joinCode === 'string' ? params.joinCode : undefined,
          organizerId: typeof params.organizerId === 'string' ? params.organizerId : undefined,
        }
      : null;

  const [eventData, setEventData] = useState<any>(initialEventData);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialEventData);
  const [isOrganizer, setIsOrganizer] = useState(initialEventData?.organizerId === currentUid);

  const [activeTab, setActiveTab] = useState<EventTab>('details');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimePollModeModalOpen, setIsTimePollModeModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<PollModalConfig>(EMPTY_MODAL_CONFIG);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isTimeAvailabilityModalOpen, setIsTimeAvailabilityModalOpen] = useState(false);
  const [availabilityPoll, setAvailabilityPoll] = useState<any>(null);
  const [isAvailabilityPickerOpen, setIsAvailabilityPickerOpen] = useState(false);
  const [tieBreakerPoll, setTieBreakerPoll] = useState<any>(null);
  const [actionPoll, setActionPoll] = useState<any>(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[] | null>(null);
  const quickPollSyncingRef = useRef<Record<LinkedField, string | null>>({ time: null, location: null });
  const availabilityFinalizingRef = useRef<Set<string>>(new Set());
  const modalConfigResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoEndingEventRef = useRef(false);
  const mobileTabOffset = useRef(new Animated.Value(0)).current;
  const [hasAccess, setHasAccess] = useState(false);
  const [mobileTabWidth, setMobileTabWidth] = useState(0);
  const seenPollLoadRef = useRef<Set<string>>(new Set());
  const resultsViewStartedAtRef = useRef<number | null>(null);
  const postVoteRefreshTrackedRef = useRef(false);

  const joinLink = buildJoinLink(eventData?.joinCode);
  const mobileTabIndex = MOBILE_EVENT_TABS.indexOf(activeTab);
  const resolvedMobileTabWidth = mobileTabWidth || Math.max(width - 32, 1);
  const isMobileWeb = isMobile && Platform.OS === 'web';

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
    if (modalConfigResetTimeoutRef.current) {
      clearTimeout(modalConfigResetTimeoutRef.current);
      modalConfigResetTimeoutRef.current = null;
    }
    setModalConfig({
      question,
      choices: [...choices],
      pollIdToEdit: undefined,
      linkedField,
      initialEditState: undefined,
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    if (modalConfigResetTimeoutRef.current) {
      clearTimeout(modalConfigResetTimeoutRef.current);
      modalConfigResetTimeoutRef.current = null;
    }
    setModalConfig(EMPTY_MODAL_CONFIG);
    setIsModalOpen(true);
  };

  const queueAvailabilityNotification = async (title: string, body: string) => {
    if (!id) return;

    try {
      await enqueueNotificationJob({
        eventId: id as string,
        type: 'poll_created',
        title,
        body,
      });
    } catch (error) {
      console.error('Error queueing availability notification:', error);
    }
  };

  const openTimeAvailabilityModal = () => {
    setIsTimeAvailabilityModalOpen(true);
  };

  const openTimePollModeModal = () => {
    setIsTimePollModeModalOpen(true);
  };

  const createDateAvailabilityPoll = async () => {
    if (!id) return;

    try {
      await addDoc(collection(db, 'events', id as string, 'polls'), {
        question: 'Which dates work best?',
        type: 'availability',
        availabilityMode: 'date',
        linkedField: 'time',
        availableDateKeys: createFutureDateKeys(),
        availabilityByUser: {},
        createdAt: serverTimestamp(),
        status: 'active',
        maxPromotedDates: MAX_PROMOTED_DATES,
        nextStageDurationHours: DEFAULT_AVAILABILITY_STAGE_DURATION_HOURS,
        startHour: DEFAULT_AVAILABILITY_START_HOUR,
        endHour: DEFAULT_AVAILABILITY_END_HOUR,
        expiresAt: new Date(Date.now() + DEFAULT_AVAILABILITY_STAGE_DURATION_HOURS * 60 * 60 * 1000),
      });

      await queueAvailabilityNotification(
        'Date Availability Open!',
        'Pick every date that works for you. The top dates will move on to the time poll.'
      );
      setIsTimePollModeModalOpen(false);
    } catch (error) {
      console.error('Error creating date availability poll:', error);
    }
  };

  const openTieBreaker = (poll: any) => {
    setTieBreakerPoll(poll);
  };

  const handleSelectFinalTimeSlot = async (poll: any, slotKey: string) => {
    if (!id) return;

    const [dateKey, hourString] = slotKey.split('|');
    const finalTime = formatDateTimeSlotLabel(dateKey, Number(hourString));

    await updateDoc(doc(db, 'events', id as string), {
      time: finalTime,
    });

    await updateDoc(doc(db, 'events', id as string, 'polls', poll.id), {
      status: 'ended',
      finalizedAt: serverTimestamp(),
      winningSlotKey: slotKey,
      winningLabel: finalTime,
      tiedSlotKeys: [],
    });

    trackEvent('availability_time_tie_resolved', {
      event_id: id as string,
      poll_id: poll.id,
      slot_key: slotKey,
    });
  };

  const openLinkedPollFlow = (field: LinkedField) => {
    if (field === 'time') {
      trackEvent('item_create_started', {
        event_id: id as string,
        item_type: 'availability_poll',
        linked_field: field,
      });
      openTimePollModeModal();
      return;
    }

    openModal('Where we going?', ['', ''], field);
  };

  const openEditEvent = () => {
    if (!id) return;

    router.push({
      pathname: '/edit/[id]',
      params: {
        id: id as string,
        title: eventData?.title ?? '',
        time: eventData?.time ?? '',
        location: eventData?.location ?? '',
        identityRequirement: eventData?.identityRequirement === 'linked_account' ? 'linked_account' : 'none',
        status: eventData?.status === 'ended' ? 'ended' : 'voting',
      },
    });
  };

  const closePollModal = () => {
    setIsModalOpen(false);
    if (modalConfigResetTimeoutRef.current) {
      clearTimeout(modalConfigResetTimeoutRef.current);
    }
    modalConfigResetTimeoutRef.current = setTimeout(() => {
      setModalConfig(EMPTY_MODAL_CONFIG);
      modalConfigResetTimeoutRef.current = null;
    }, 220);
  };

  const openAvailabilityPicker = (poll: any) => {
    if (poll?.status !== 'active') return;

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
      itemType === 'role' ? 'Role still open!' : "Don't forget to vote!",
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
    const mobileToastStyle =
      Platform.OS === 'web'
        ? undefined
        : {
            backgroundColor: '#27272a',
            opacity: 1,
            elevation: 10,
          };

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
            <Toast
              nativeID={toastId}
              className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg"
              style={mobileToastStyle}
            >
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
          <Toast
            nativeID={toastId}
            className="bg-zinc-800 border border-red-500 mt-24 px-4 py-3 rounded-xl shadow-lg"
            style={mobileToastStyle}
          >
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

  const isAvailabilityPoll = (poll: any) => poll?.type === 'availability';
  const isDateAvailabilityPoll = (poll: any) => isAvailabilityPoll(poll) && getAvailabilityMode(poll) === 'date';
  const isTimeAvailabilityPoll = (poll: any) => isAvailabilityPoll(poll) && getAvailabilityMode(poll) === 'time';

  const isAvailabilityPollExpired = (poll: any) => {
    if (!isAvailabilityPoll(poll)) return false;
    if (poll?.status === 'awaiting_selection' || poll?.status === 'ended') return true;
    const expiresAtDate = getAvailabilityExpiresAtDate(poll);
    return !!expiresAtDate && new Date() > expiresAtDate;
  };

  const finalizeAvailabilityPoll = async (poll: any) => {
    if (!id) return;

    const pollRef = doc(db, 'events', id as string, 'polls', poll.id);
    const pollSnap = await getDoc(pollRef);
    if (!pollSnap.exists()) return;

    const latestPoll: any = { id: pollSnap.id, ...pollSnap.data() };
    if (latestPoll.status !== 'active') return;

    if (isDateAvailabilityPoll(latestPoll)) {
      const promotedDateKeys = getTopAvailabilityDates(latestPoll, latestPoll.maxPromotedDates || MAX_PROMOTED_DATES)
        .map((entry) => entry.dateKey);

      const nextStageDurationHours =
        typeof latestPoll.nextStageDurationHours === 'number'
          ? latestPoll.nextStageDurationHours
          : DEFAULT_AVAILABILITY_STAGE_DURATION_HOURS;

      let nextStagePollId: string | null = null;
      if (promotedDateKeys.length > 0) {
        const nextStagePoll = await addDoc(collection(db, 'events', id as string, 'polls'), {
          question: 'What times work best?',
          type: 'availability',
          availabilityMode: 'time',
          linkedField: 'time',
          selectedDates: promotedDateKeys,
          startHour:
            typeof latestPoll.startHour === 'number'
              ? latestPoll.startHour
              : DEFAULT_AVAILABILITY_START_HOUR,
          endHour:
            typeof latestPoll.endHour === 'number'
              ? latestPoll.endHour
              : DEFAULT_AVAILABILITY_END_HOUR,
          availabilityByUser: {},
          createdAt: serverTimestamp(),
          status: 'active',
          sourcePollId: latestPoll.id,
          expiresAt: new Date(Date.now() + nextStageDurationHours * 60 * 60 * 1000),
        });

        nextStagePollId = nextStagePoll.id;
        await queueAvailabilityNotification(
          'Time Availability Open!',
          'The top dates are in. Pick the hours you are free for each finalist date.'
        );
      }

      await updateDoc(pollRef, {
        status: 'ended',
        finalizedAt: serverTimestamp(),
        winningDateKeys: promotedDateKeys,
        nextStagePollId,
      });

      trackEvent('availability_date_stage_completed', {
        event_id: id as string,
        poll_id: latestPoll.id,
        promoted_date_count: promotedDateKeys.length,
      });

      return;
    }

    const winningSlots = getTopAvailabilitySlots(latestPoll, 100);
    if (winningSlots.length === 0) {
      await updateDoc(pollRef, {
        status: 'ended',
        finalizedAt: serverTimestamp(),
        winningSlotKey: null,
      });
      return;
    }

    const highestCount = winningSlots[0].count;
    const tiedWinningSlots = winningSlots.filter((slot) => slot.count === highestCount);

    if (tiedWinningSlots.length === 1) {
      const finalSlot = tiedWinningSlots[0];
      const finalTime = formatDateTimeSlotLabel(finalSlot.dateKey, finalSlot.hour);

      await updateDoc(doc(db, 'events', id as string), {
        time: finalTime,
      });

      await updateDoc(pollRef, {
        status: 'ended',
        finalizedAt: serverTimestamp(),
        winningSlotKey: finalSlot.slotKey,
        winningLabel: finalTime,
      });

      trackEvent('availability_time_stage_completed', {
        event_id: id as string,
        poll_id: latestPoll.id,
        winning_slot: finalSlot.slotKey,
      });

      if (eventCreatedAtMs) {
        void trackEventOnce(
          `decision_reached:${id as string}:time:${latestPoll.id}`,
          'time_to_decision_measured',
          {
            event_id: id as string,
            field: 'time',
            poll_id: latestPoll.id,
            duration_seconds: Number(((Date.now() - eventCreatedAtMs) / 1000).toFixed(2)),
          }
        );
      }
      return;
    }

    await updateDoc(pollRef, {
      status: 'awaiting_selection',
      finalizedAt: serverTimestamp(),
      tiedSlotKeys: tiedWinningSlots.map((slot) => slot.slotKey),
    });

    trackEvent('availability_time_stage_tied', {
      event_id: id as string,
      poll_id: latestPoll.id,
      tied_slot_count: tiedWinningSlots.length,
    });
  };

  const eventCreatedAtMs = eventData?.createdAt?.toDate
    ? eventData.createdAt.toDate().getTime()
    : eventData?.createdAt
      ? new Date(eventData.createdAt).getTime()
      : null;

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
          if (eventCreatedAtMs) {
            void trackEventOnce(
              `decision_reached:${id as string}:${field}:${linkedQuickPoll.id}`,
              'time_to_decision_measured',
              {
                event_id: id as string,
                field,
                poll_id: linkedQuickPoll.id,
                duration_seconds: Number(((Date.now() - eventCreatedAtMs) / 1000).toFixed(2)),
              }
            );
          }
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
          if (eventCreatedAtMs) {
            void trackEventOnce(
              `decision_reached:${id as string}:${field}:${linkedQuickPoll.id}`,
              'time_to_decision_measured',
              {
                event_id: id as string,
                field,
                poll_id: linkedQuickPoll.id,
                duration_seconds: Number(((Date.now() - eventCreatedAtMs) / 1000).toFixed(2)),
              }
            );
          }
        } catch (error) {
          quickPollSyncingRef.current[field] = null;
          console.error(`Error syncing ${field} quick poll result:`, error);
        }
      }
    };

    syncQuickPollDetails();
  }, [id, eventData, polls, hasAccess, eventCreatedAtMs]);

  useEffect(() => {
    if (!id || !hasAccess) return;

    const processAvailabilityPolls = async () => {
      for (const poll of polls) {
        if (!isAvailabilityPoll(poll)) continue;
        if (poll?.status !== 'active') continue;
        if (!isAvailabilityPollExpired(poll)) continue;
        if (availabilityFinalizingRef.current.has(poll.id)) continue;

        availabilityFinalizingRef.current.add(poll.id);
        try {
          await finalizeAvailabilityPoll(poll);
        } catch (error) {
          console.error('Error finalizing availability poll:', error);
        } finally {
          availabilityFinalizingRef.current.delete(poll.id);
        }
      }
    };

    void processAvailabilityPolls();
  }, [id, polls, hasAccess]);

  useEffect(() => {
    return () => {
      if (modalConfigResetTimeoutRef.current) {
        clearTimeout(modalConfigResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!id || !currentUid || !hasAccess || isOrganizer) return;

    void ensureAnalyticsJourneyStarted(`event_vote_flow:${id as string}:${currentUid}`, {
      event_id: id as string,
      source: 'event_screen',
    });
  }, [id, currentUid, hasAccess, isOrganizer]);

  useEffect(() => {
    if (!id || !currentUid || !hasAccess) return;

    polls.forEach((poll) => {
      const loadKey = `${id as string}:${currentUid}:${poll.id}`;
      if (!seenPollLoadRef.current.has(loadKey)) {
        seenPollLoadRef.current.add(loadKey);
        void trackEvent('poll_loaded', {
          event_id: id as string,
          poll_id: poll.id,
          item_type: getEventItemType(poll),
          is_expired: isPollExpired(poll),
        });
      }

      const hasResponded = getRespondedUserIds(poll).includes(currentUid);
      if (isPollExpired(poll) && !hasResponded) {
        void trackEventOnce(`poll_missed:${currentUid}:${poll.id}`, 'poll_missed', {
          event_id: id as string,
          poll_id: poll.id,
          item_type: getEventItemType(poll),
        });
      }
    });
  }, [polls, currentUid, hasAccess, id]);

  useEffect(() => {
    if (!isMobile || mobileTabWidth <= 0) return;

    Animated.timing(mobileTabOffset, {
      toValue: -(mobileTabIndex * mobileTabWidth),
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
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
      void trackEvent('poll_response_submitted', {
        event_id: id as string,
        poll_id: pollId,
        item_type: updatedItemType,
        feature_name: roleAction ? 'role_card' : 'basic_poll',
        selection_count: Array.isArray(selectedIndices) ? selectedIndices.length : 1,
      });
      void completeAnalyticsJourney(`event_vote_flow:${id as string}:${uid}`, 'time_to_vote_measured', {
        event_id: id as string,
        poll_id: pollId,
        item_type: updatedItemType,
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
      if (isAvailabilityPoll(poll)) {
        await finalizeAvailabilityPoll({
          ...poll,
          expiresAt: new Date(),
        });
        trackEvent('poll_ended_early', { event_id: id as string, poll_id: poll.id });
        return;
      }

      await updateDoc(doc(db, 'events', id as string, 'polls', poll.id), {
        expiresAt: new Date()
      });
      trackEvent('poll_ended_early', { event_id: id as string, poll_id: poll.id });
    } catch (error) {
      console.error('Error ending poll early:', error);
    }
  };

  const handleEditPoll = (poll: any) => {
    const itemType = getEventItemType(poll) === 'role' ? 'role' : 'poll';
    trackEvent(getEventItemType(poll) === 'role' ? 'role_edit_started' : 'poll_edit_started', { event_id: id as string, poll_id: poll.id });
    setModalConfig({ 
      question: poll.question, 
      choices: Array.isArray(poll.options) && poll.options.length > 0 ? poll.options.map((o: any) => o.text) : ['', ''],
      pollIdToEdit: poll.id,
      linkedField: poll.linkedField,
      initialEditState: {
        createType: itemType,
        allowMultiple: !!poll.allowMultiple,
        allowInviteeChoices: !!poll.allowInviteeChoices,
        endCondition: poll.endCondition === 'vote_count' ? 'vote_count' : 'time',
        targetVoteCount: poll.targetVoteCount ? String(poll.targetVoteCount) : '5',
        slotLimitMode: poll.slotLimit == null ? 'unlimited' : 'limited',
        slotLimit: poll.slotLimit != null ? String(poll.slotLimit) : '1',
      },
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
      initialEditState: undefined,
    });
    setIsModalOpen(true);
  };

  const isPollExpired = (poll: any) => {
    if (isAvailabilityPoll(poll)) return isAvailabilityPollExpired(poll);
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

    await updateDoc(doc(db, 'events', id as string, 'polls', pollId), {
      [`availabilityByUser.${uid}`]: [...new Set(slotKeys)].sort(),
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

  useEffect(() => {
    if (!isMobile) return;

    if (activeTab === 'answered') {
      if (resultsViewStartedAtRef.current == null) {
        resultsViewStartedAtRef.current = Date.now();
      }
      return;
    }

    if (resultsViewStartedAtRef.current != null) {
      const durationSeconds = Number(((Date.now() - resultsViewStartedAtRef.current) / 1000).toFixed(2));
      resultsViewStartedAtRef.current = null;
      void trackEvent('results_dwell_time', {
        event_id: id as string,
        duration_seconds: durationSeconds,
        answered_poll_count: answeredPolls.length,
        source: 'mobile_results_tab',
      });
    }
  }, [activeTab, answeredPolls.length, id, isMobile]);

  useEffect(() => {
    return () => {
      if (!isMobile || resultsViewStartedAtRef.current == null) return;
      const durationSeconds = Number(((Date.now() - resultsViewStartedAtRef.current) / 1000).toFixed(2));
      void trackEvent('results_dwell_time', {
        event_id: id as string,
        duration_seconds: durationSeconds,
        answered_poll_count: answeredPolls.length,
        source: 'mobile_results_tab',
      });
    };
  }, [answeredPolls.length, id, isMobile]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !id || !currentUid || answeredPolls.length === 0 || postVoteRefreshTrackedRef.current) {
      return;
    }

    const navigationEntry = typeof performance !== 'undefined'
      ? (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)
      : undefined;

    if (navigationEntry?.type !== 'reload') return;

    postVoteRefreshTrackedRef.current = true;
    void incrementAnalyticsCounter(`post_vote_refresh:${id as string}:${currentUid}`)
      .then((count) => trackEvent('post_vote_refresh', {
        event_id: id as string,
        refresh_count: count,
        answered_poll_count: answeredPolls.length,
      }))
      .catch((error) => console.error('Error tracking post-vote refresh:', error));
  }, [answeredPolls.length, currentUid, id]);

  const roleAssignments = polls.reduce<Record<string, string[]>>((acc, poll) => {
    if (getEventItemType(poll) === 'role') {
      getRespondedUserIds(poll).forEach((uid) => {
        acc[uid] = [...(acc[uid] || []), poll.question];
      });
    }

    return acc;
  }, {});
  const headcount = participantIds?.length ?? null;
  const dateAvailabilityPoll = polls.find((poll) => isDateAvailabilityPoll(poll) && poll.linkedField === 'time' && poll?.status === 'active');
  const activeTimeAvailabilityPoll = polls.find((poll) => isTimeAvailabilityPoll(poll) && poll.linkedField === 'time' && poll?.status === 'active');
  const timeTieSelectionPoll = polls.find((poll) => isTimeAvailabilityPoll(poll) && poll.linkedField === 'time' && poll?.status === 'awaiting_selection');
  const timeAvailabilityPoll = timeTieSelectionPoll || activeTimeAvailabilityPoll || dateAvailabilityPoll;
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
    const defaultButtonLabel = field === 'time' ? 'Poll Time' : 'Poll Location';

    if (field === 'time' && timeTieSelectionPoll) {
      if (isOrganizer) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="self-start border-zinc-600 bg-zinc-800 mt-2"
            onPress={() => openTieBreaker(timeTieSelectionPoll)}
          >
            <ButtonText className="text-zinc-50 font-semibold">Choose Final Time</ButtonText>
          </Button>
        );
      }

      return (
        <Text className="text-amber-300 text-base font-semibold">
          Organizer choosing final time
        </Text>
      );
    }

    if (field === 'time' && dateAvailabilityPoll) {
      return (
        <Text className="text-emerald-400 text-base font-semibold">
          Date availability open
        </Text>
      );
    }

    if (field === 'time' && activeTimeAvailabilityPoll) {
      return (
        <Text className="text-emerald-400 text-base font-semibold">
          Time availability open
        </Text>
      );
    }

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
          onPress={() => openLinkedPollFlow(field)}
        >
          <ButtonText className="text-zinc-50 font-semibold">{field === 'time' ? 'Poll Time' : 'Rerun Poll'}</ButtonText>
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
        onPress={() => openLinkedPollFlow(field)}
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
            <Text className="text-zinc-50 text-lg font-semibold mt-0.5">
              {headcount == null ? '...' : `${headcount} ${headcount === 1 ? 'person' : 'people'}`}
            </Text>
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
            onPress={openEditEvent}
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
          onResolveTie={openTieBreaker}
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

  const renderMobileTabContent = () => {
    if (activeTab === 'active') return renderActiveTab();
    if (activeTab === 'answered') return renderAnsweredTab();
    return renderDetailsTab();
  };

  if (loading && !eventData) {
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
            timeAvailabilityPoll={timeAvailabilityPoll}
            timeQuickPoll={timeQuickPoll}
            locationQuickPoll={locationQuickPoll}
            isQuickPollExpired={isPollExpired}
            getQuickPollWinner={getWinningOption}
            onBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
            onShowQR={() => {
              trackEvent('qr_modal_opened', { event_id: id as string });
              setIsQRModalOpen(true);
            }}
            onOpenLinkedPoll={openLinkedPollFlow}
            onResolveTimeTie={timeTieSelectionPoll ? () => openTieBreaker(timeTieSelectionPoll) : undefined}
            onShowParticipants={() => {
              trackEvent('participants_modal_opened', { event_id: id as string });
              setIsParticipantsModalOpen(true);
            }}
            onEditEvent={() => {
              trackEvent('event_edit_started', { event_id: id as string });
              openEditEvent();
            }}
          />
        )}

        {isMobile ? (
          <>
            {/* --- NEW COMPACT MOBILE HEADER --- */}
            <VStack className="gap-4 mb-4">
              
              {/* Back Button */}
              <Button variant="link" className="self-start p-0 -ml-2" onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}>
                <ButtonText className="text-blue-500">{'< Dashboard'}</ButtonText>
              </Button>

              {/* Title & Code on One Line */}
              <HStack className="justify-between items-center gap-4">
                <Heading size="2xl" className="text-zinc-50 flex-1" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
                  {eventData?.title}
                </Heading>
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
            {isMobileWeb ? (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <VStack className="gap-4 pb-12">
                  {renderMobileTabContent()}
                </VStack>
              </ScrollView>
            ) : (
              <View
                className="flex-1"
                style={{ overflow: 'hidden' }}
                onLayout={(event) => {
                  const nextWidth = Math.round(event.nativeEvent.layout.width);
                  if (!nextWidth || nextWidth === mobileTabWidth) return;
                  setMobileTabWidth(nextWidth);
                }}
                {...mobileTabPanResponder.panHandlers}
              >
                <Animated.View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    width: resolvedMobileTabWidth * MOBILE_EVENT_TABS.length,
                    transform: [{ translateX: mobileTabOffset }],
                  }}
                >
                  <View style={{ width: resolvedMobileTabWidth, minWidth: resolvedMobileTabWidth, maxWidth: resolvedMobileTabWidth, flexShrink: 0 }}>
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                      <VStack className="gap-4 pb-12">
                        {renderDetailsTab()}
                      </VStack>
                    </ScrollView>
                  </View>

                  <View style={{ width: resolvedMobileTabWidth, minWidth: resolvedMobileTabWidth, maxWidth: resolvedMobileTabWidth, flexShrink: 0 }}>
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                      <VStack className="gap-4 pb-12">
                        {renderActiveTab()}
                      </VStack>
                    </ScrollView>
                  </View>

                  <View style={{ width: resolvedMobileTabWidth, minWidth: resolvedMobileTabWidth, maxWidth: resolvedMobileTabWidth, flexShrink: 0 }}>
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                      <VStack className="gap-4 pb-12">
                        {renderAnsweredTab()}
                      </VStack>
                    </ScrollView>
                  </View>
                </Animated.View>
              </View>
            )}
           </>
        ) : (
          /* --- DESKTOP VIEW --- */
          <View className="flex-1 flex-col md:flex-row gap-8 w-full pb-6">
            <View className="flex-1">
              <HStack className="justify-between items-center mb-4">
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
              <HStack className="justify-between items-center mb-4">
                <View className="justify-center" style={{ minHeight: 36 }}>
                  <Heading size="xl" className="text-zinc-50">Answered / Results</Heading>
                </View>
                <View style={{ height: 36 }} />
              </HStack>
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
      <PollModal
        visible={isModalOpen}
        eventId={id as string}
        onClose={closePollModal}
        initialQuestion={modalConfig.question}
        initialChoices={modalConfig.choices}
        pollIdToEdit={modalConfig.pollIdToEdit}
        linkedField={modalConfig.linkedField}
        initialEditState={modalConfig.initialEditState}
      />
      <TimePollModeModal
        visible={isTimePollModeModalOpen}
        onClose={() => setIsTimePollModeModalOpen(false)}
        onChooseInviteesDecideDates={() => {
          void createDateAvailabilityPoll();
        }}
        onChooseCreatorSelectsDates={() => {
          setIsTimePollModeModalOpen(false);
          openTimeAvailabilityModal();
        }}
        onChooseManual={() => {
          setIsTimePollModeModalOpen(false);
          openEditEvent();
        }}
      />
      <TimeAvailabilityModal visible={isTimeAvailabilityModalOpen} eventId={id as string} onClose={() => setIsTimeAvailabilityModalOpen(false)} />
      <DateAvailabilityPickerModal
        visible={isAvailabilityPickerOpen && isDateAvailabilityPoll(availabilityPoll)}
        poll={isDateAvailabilityPoll(availabilityPoll) ? availabilityPoll : null}
        currentUid={currentUid}
        onClose={() => {
          setIsAvailabilityPickerOpen(false);
          setAvailabilityPoll(null);
        }}
        onSave={handleSaveAvailability}
      />
      <AvailabilityPickerModal
        visible={isAvailabilityPickerOpen && isTimeAvailabilityPoll(availabilityPoll)}
        poll={isTimeAvailabilityPoll(availabilityPoll) ? availabilityPoll : null}
        currentUid={currentUid}
        onClose={() => {
          setIsAvailabilityPickerOpen(false);
          setAvailabilityPoll(null);
        }}
        onSave={handleSaveAvailability}
      />
      <FinalTimeSelectionModal
        visible={!!tieBreakerPoll}
        poll={tieBreakerPoll}
        onClose={() => setTieBreakerPoll(null)}
        onSelectSlot={handleSelectFinalTimeSlot}
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
        participantIds={participantIds ?? []}
        roleAssignments={roleAssignments}
        organizerId={eventData?.organizerId}
        eventId={id as string}
      />
    </Box>
  );
}
