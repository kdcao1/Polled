import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  for (let i = 0; i < startDay; i += 1) cells.push({ date: null, key: `blank-start-${i}` });
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day), key: `day-${day}` });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `blank-end-${cells.length}` });
  }

  return cells;
};

const formatDateLabel = (dateKey: string) => fromDateKey(dateKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatFullDateLabel = (dateKey: string) => fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const formatHourLabel = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00 ${suffix}`;
};

const buildAvailabilitySlotKeys = (dateKeys: string[], startHour = 8, endHour = 20) => {
  return dateKeys.flatMap((dateKey) => {
    const slots: string[] = [];
    for (let hour = startHour; hour < endHour; hour += 1) {
      slots.push(`${dateKey}|${hour}`);
    }
    return slots;
  });
};

const slotKeyToParts = (slotKey: string) => {
  const [dateKey, hourString] = slotKey.split('|');
  return { dateKey, hour: Number(hourString) };
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
    .map(([slotKey, count]) => ({ slotKey, count, ...slotKeyToParts(slotKey) }));
};



// ---------------------------------------------------------------------------
// PollModal — generic poll builder for non-time polls
// ---------------------------------------------------------------------------
interface PollModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  initialQuestion?: string;
  initialChoices?: string[];
}

function PollModal({ visible, eventId, onClose, initialQuestion, initialChoices }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
    if (visible) {
      setQuestion(initialQuestion || '');
      setChoices(initialChoices && initialChoices.length > 0 ? initialChoices : ['', '']);
      setAllowMultiple(false);
      setIsDropdownOpen(false);
      setDurationHours(24);
    }
  }, [visible, initialQuestion, initialChoices]);

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
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

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
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Something went wrong saving your poll. Try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-md max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-6">
            <Heading size="xl" className="text-zinc-50">Create a Poll</Heading>
            <HStack className="gap-2">
              <Button size="sm" variant="link" onPress={handleClearForm}><ButtonText className="text-red-400 font-semibold">Clear</ButtonText></Button>
              <Button size="sm" variant="link" onPress={onClose}><ButtonText className="text-zinc-400">Cancel</ButtonText></Button>
            </HStack>
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack className="gap-6 pb-2">
              <VStack className="gap-2">
                <Text className="text-zinc-300 font-bold ml-1">Main Question</Text>
                <Input variant="outline" size="xl" className="border-zinc-700">
                  <InputField placeholder="e.g., Which place sounds best?" placeholderTextColor="#a1a1aa" className="text-zinc-50" value={question} onChangeText={setQuestion} />
                </Input>
              </VStack>

              <HStack className="justify-between items-center bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                <Text className="text-zinc-50 font-bold">Allow Multiple Choices</Text>
                <Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ false: '#3f3f46', true: '#2563eb' }} />
              </HStack>

              <VStack className="gap-2 mt-2">
                <Text className="text-zinc-300 font-bold ml-1">Poll Duration</Text>
                <TouchableOpacity activeOpacity={0.7} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center" onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <Text className="text-zinc-50 font-medium text-base">{DURATION_OPTIONS.find(opt => opt.value === durationHours)?.label}</Text>
                  <Text className="text-zinc-400 text-xs">{isDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {Platform.OS === 'web' && isDropdownOpen && (
                  <View className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden mt-1 max-h-48">
                    <ScrollView nestedScrollEnabled>
                      {DURATION_OPTIONS.map((option) => (
                        <TouchableOpacity key={option.value} className={`p-4 border-b border-zinc-700/50 ${durationHours === option.value ? 'bg-zinc-700' : ''}`} onPress={() => { setDurationHours(option.value); setIsDropdownOpen(false); }}>
                          <Text className={`font-medium ${durationHours === option.value ? 'text-blue-400' : 'text-zinc-300'}`}>{option.label}</Text>
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
                    <InputField placeholder={`Option ${index + 1}`} placeholderTextColor="#52525b" className="text-zinc-50" value={choice} onChangeText={(value) => handleUpdateChoice(value, index)} />
                  </Input>
                ))}
                <Button variant="outline" action="secondary" className="border-zinc-700 border-dashed mt-2" onPress={handleAddChoice}>
                  <ButtonText className="text-zinc-400 font-bold">+ Add Another Option</ButtonText>
                </Button>
              </VStack>

              <Button size="xl" action="primary" className="bg-blue-600 border-0 mt-4 mb-4" onPress={handleCreatePoll} isDisabled={!question.trim() || choices.some((c) => !c.trim())}>
                <ButtonText className="font-bold text-white">Publish Poll</ButtonText>
              </Button>
            </VStack>
          </ScrollView>
        </View>

        {Platform.OS !== 'web' && isDropdownOpen && (
          <View className="absolute top-0 bottom-0 left-0 right-0 justify-end z-50">
            <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/70" onPress={() => setIsDropdownOpen(false)} />
            <View className="bg-[#1c1c1e] rounded-t-[32px] pt-3 pb-10 px-4 shadow-2xl w-full max-w-md self-center">
              <View className="w-10 h-1.5 bg-zinc-600 rounded-full self-center mb-6" />
              <Text className="text-zinc-300 font-bold text-sm mb-3 ml-2 tracking-wide">Poll Duration</Text>
              <View className="bg-zinc-800 rounded-2xl overflow-hidden">
                <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                  {DURATION_OPTIONS.map((option, index) => {
                    const isSelected = durationHours === option.value;
                    const isLast = index === DURATION_OPTIONS.length - 1;
                    return (
                      <TouchableOpacity key={option.value} activeOpacity={0.7} className={`flex-row justify-between items-center p-5 ${!isLast ? 'border-b border-zinc-700/50' : ''}`} onPress={() => { setDurationHours(option.value); setTimeout(() => setIsDropdownOpen(false), 200); }}>
                        <Text className={`text-base ${isSelected ? 'text-zinc-50 font-medium' : 'text-zinc-300'}`}>{option.label}</Text>
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-zinc-500'}`}>{isSelected && <View className="w-3 h-3 rounded-full bg-indigo-500" />}</View>
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
    if (visible) {
      setCalendarMonth(new Date());
      setSelectedDates([]);
    }
  }, [visible]);

  const toggleDate = (date: Date) => {
    const key = toDateKey(date);
    if (key < todayKey) return;
    setSelectedDates((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key].sort());
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
      alert('Unable to create the availability calendar right now.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-xl max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-4">
            <VStack>
              <Heading size="xl" className="text-zinc-50">Select candidate dates</Heading>
              <Text className="text-zinc-400 mt-1">Choose the dates attendees should fill in, then they’ll drag over their available hours.</Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}><ButtonText className="text-zinc-400">Cancel</ButtonText></Button>
          </HStack>

          <HStack className="items-center justify-between mb-4 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><Text className="text-blue-400 font-semibold">← Prev</Text></TouchableOpacity>
            <Text className="text-zinc-50 font-bold text-lg">{MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</Text>
            <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><Text className="text-blue-400 font-semibold">Next →</Text></TouchableOpacity>
          </HStack>

          <VStack className="gap-2">
            <HStack className="gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} className="flex-1 items-center py-2"><Text className="text-zinc-500 text-xs font-bold uppercase">{label}</Text></View>
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
                    <Text className={`font-semibold ${selected ? 'text-white' : 'text-zinc-200'}`}>{cell.date.getDate()}</Text>
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
                <Text className="text-zinc-200">{selectedDates.map(formatFullDateLabel).join(' • ')}</Text>
              )}
            </View>
          </VStack>

          <Button size="xl" action="primary" className="bg-blue-600 border-0 mt-6" onPress={handleCreateAvailabilityPoll} isDisabled={selectedDates.length === 0}>
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
    if (visible && poll) {
      setSelectedSlots(getCurrentUserAvailability(poll, currentUid));
      setIsDragging(false);
    }
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
    const currentlySelected = selectedSlots.includes(slotKey);
    const nextMode: 'add' | 'remove' = currentlySelected ? 'remove' : 'add';
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
      await onSave(poll.id, selectedSlots.sort());
      onClose();
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Could not save availability. Please try again.');
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
              <Text className="text-zinc-400 mt-1">Drag across hours to mark when you’re free. On touch devices, tap individual blocks.</Text>
            </VStack>
            <Button size="sm" variant="link" onPress={onClose}><ButtonText className="text-zinc-400">Cancel</ButtonText></Button>
          </HStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <VStack className="gap-2 pb-2" onTouchEnd={() => setIsDragging(false)}>
              <HStack className="gap-2">
                <View style={{ width: 84 }} />
                {dateKeys.map((dateKey) => (
                  <View key={dateKey} className="bg-zinc-800 border border-zinc-700 rounded-xl py-3 items-center" style={{ width: 140 }}>
                    <Text className="text-zinc-100 font-semibold">{formatDateLabel(dateKey)}</Text>
                    <Text className="text-zinc-500 text-xs mt-1">{fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
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
                      const webHandlers = Platform.OS === 'web' ? {
                        onMouseDown: () => handleSlotStart(slotKey),
                        onMouseEnter: () => handleSlotEnter(slotKey),
                        onMouseUp: () => setIsDragging(false),
                      } : {};
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
                            <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-zinc-500'}`}>{selected ? 'Available' : ''}</Text>
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
            <Text className="text-zinc-400">{selectedSlots.length} hour block{selectedSlots.length === 1 ? '' : 's'} selected</Text>
            <Button size="lg" action="primary" className="bg-blue-600 border-0" onPress={handleSave} isDisabled={saving}>
              <ButtonText className="font-bold text-white">Save Availability</ButtonText>
            </Button>
          </HStack>
        </View>
      </View>
    </Modal>
  );
}

const formatTimeLeft = (expirationDate: Date) => {
  const diffMs = expirationDate.getTime() - new Date().getTime();
  if (diffMs <= 0) return 'Ended';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `Ends in ${diffDays}d`;
  if (diffHours > 0) return `Ends in ${diffHours}h`;
  if (diffMinutes > 0) return `Ends in ${diffMinutes}m`;
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
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [availabilityPoll, setAvailabilityPoll] = useState<any | null>(null);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);

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

  const handleSaveAvailability = async (pollId: string, slotKeys: string[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const poll = polls.find((item) => item.id === pollId);
    const existing = poll?.availabilityByUser || {};
    const updatedAvailability = { ...existing, [uid]: slotKeys };
    await updateDoc(doc(db, 'events', id as string, 'polls', pollId), { availabilityByUser: updatedAvailability });
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
  const userHasAnsweredPoll = (poll: any) => {
    if (poll.type === 'availability') {
      return getCurrentUserAvailability(poll, currentUid).length > 0;
    }
    return poll.options.some((opt: any) => opt.voterIds.includes(currentUid));
  };

  const activePolls = polls.filter((poll) => !userHasAnsweredPoll(poll));
  const answeredPolls = polls.filter((poll) => userHasAnsweredPoll(poll));

  if (loading) {
    return (
      <Box className="flex-1 bg-zinc-900 justify-center items-center">
        <Text className="text-zinc-400">Loading Event...</Text>
      </Box>
    );
  }


  // -------------------------------------------------------------------------
  // Unified Poll Card (supports both standard polls and availability calendars)
  // -------------------------------------------------------------------------
  const PollCard = ({ poll, compact = false, deletable = false, showResults = false }: { poll: any; compact?: boolean; deletable?: boolean; showResults?: boolean; }) => {
    const isAvailabilityPoll = poll.type === 'availability';
    const totalVotes = isAvailabilityPoll ? 0 : poll.options.reduce((s: number, o: any) => s + o.voterIds.length, 0);
    const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
    const [isExpired, setIsExpired] = useState(() => expiresAtDate ? new Date() > expiresAtDate : false);
    const [timeLeft, setTimeLeft] = useState(() => expiresAtDate && !isExpired ? formatTimeLeft(expiresAtDate) : '');

    useEffect(() => {
      if (!expiresAtDate || isExpired) return;
      const interval = setInterval(() => {
        if (new Date() > expiresAtDate) {
          setIsExpired(true);
          clearInterval(interval);
        } else {
          setTimeLeft(formatTimeLeft(expiresAtDate));
        }
      }, 60000);
      return () => clearInterval(interval);
    }, [expiresAtDate, isExpired]);

    const displayResults = showResults || isExpired;

    if (isAvailabilityPoll) {
      const dateKeys = Array.isArray(poll.selectedDates) ? [...poll.selectedDates].sort() : [];
      const counts = getAvailabilityCounts(poll);
      const currentSelections = getCurrentUserAvailability(poll, currentUid);
      const participantCount = Object.keys(poll.availabilityByUser || {}).filter((uid) => Array.isArray(poll.availabilityByUser?.[uid]) && poll.availabilityByUser[uid].length > 0).length;
      const topSlots = getTopAvailabilitySlots(poll, 3);

      return (
        <VStack className={`bg-zinc-800 rounded-xl border ${isExpired ? 'border-zinc-700/50 opacity-80' : 'border-zinc-700'} ${compact ? 'p-4 gap-3' : 'p-5 gap-4'}`}>
          <HStack className="justify-between items-start gap-3">
            <VStack className="flex-1 gap-1">
              <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>{poll.question}</Text>
              <Text className="text-blue-300 text-xs font-semibold uppercase tracking-wider">When2Meet-style availability</Text>
            </VStack>
            <HStack className="items-center gap-3 shrink-0">
              {!isExpired && expiresAtDate && (
                <Box className="bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50 justify-center"><Text className="text-blue-400 text-xs font-bold uppercase tracking-wider leading-none">{timeLeft}</Text></Box>
              )}
              {deletable && (
                <TouchableOpacity onPress={() => handleDeletePoll(poll.id)} className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60 justify-center"><Text className="text-red-400 text-xs font-semibold leading-none">Delete</Text></TouchableOpacity>
              )}
            </HStack>
          </HStack>

          <VStack className="gap-3">
            <Text className="text-zinc-400 text-sm">Selected dates: {dateKeys.map(formatDateLabel).join(' • ')}</Text>
            <HStack className="items-center justify-between flex-wrap gap-3">
              <Text className="text-zinc-300">{participantCount} attendee{participantCount === 1 ? '' : 's'} submitted availability</Text>
              <Button size="sm" action="primary" className="bg-blue-600 border-0" onPress={() => { setAvailabilityPoll(poll); setIsAvailabilityModalOpen(true); }}>
                <ButtonText className="font-bold text-white">{currentSelections.length > 0 ? 'Edit Availability' : 'Mark Availability'}</ButtonText>
              </Button>
            </HStack>

            {topSlots.length > 0 && (
              <VStack className="gap-2 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4">
                <Text className="text-zinc-200 font-semibold">Most popular slots</Text>
                {topSlots.map((slot) => (
                  <HStack key={slot.slotKey} className="justify-between items-center">
                    <Text className="text-zinc-300">{formatFullDateLabel(slot.dateKey)} · {formatHourLabel(slot.hour)}</Text>
                    <Text className="text-blue-300 font-bold">{slot.count} free</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {dateKeys.length > 0 && (
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
                  {Array.from({ length: Math.max((poll.endHour || 20) - (poll.startHour || 8), 0) }).map((_, idx) => {
                    const hour = (poll.startHour || 8) + idx;
                    return (
                      <HStack key={hour} className="gap-2 items-center">
                        <View style={{ width: 70 }} className="items-end pr-2"><Text className="text-zinc-500 text-[11px]">{formatHourLabel(hour)}</Text></View>
                        {dateKeys.map((dateKey) => {
                          const slotKey = `${dateKey}|${hour}`;
                          const count = counts[slotKey] || 0;
                          const selected = currentSelections.includes(slotKey);
                          return (
                            <View key={slotKey} className={`rounded-lg border items-center justify-center ${selected ? 'bg-blue-600/70 border-blue-500' : count > 0 ? 'bg-emerald-600/35 border-emerald-500/40' : 'bg-zinc-900/50 border-zinc-700'}`} style={{ width: 96, height: 28 }}>
                              <Text className={`text-[11px] font-semibold ${selected ? 'text-white' : count > 0 ? 'text-emerald-100' : 'text-zinc-600'}`}>{count > 0 ? count : ''}</Text>
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

    return (
      <VStack className={`bg-zinc-800 rounded-xl border ${isExpired ? 'border-zinc-700/50 opacity-80' : 'border-zinc-700'} gap-2 ${compact ? 'p-4' : 'p-5 gap-4'}`}>
        <HStack className="justify-between items-start">
          <VStack className={`flex-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
            <HStack className="items-center gap-2 mb-1 flex-wrap"><Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>{poll.question}</Text></HStack>
            {poll.allowMultiple && !isExpired && <Text className={`text-blue-400 font-semibold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>Select Multiple</Text>}
          </VStack>
          <HStack className="items-center gap-3 shrink-0">
            {isExpired && <Box className="bg-red-500/20 px-2 py-1 rounded border border-red-500 justify-center"><Text className="text-red-400 text-xs font-bold uppercase tracking-wider leading-none">Ended</Text></Box>}
            {!isExpired && expiresAtDate && <Box className="bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50 justify-center"><Text className="text-blue-400 text-xs font-bold uppercase tracking-wider leading-none">{timeLeft}</Text></Box>}
            {deletable && <TouchableOpacity onPress={() => handleDeletePoll(poll.id)} className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60 justify-center" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text className="text-red-400 text-xs font-semibold leading-none">Delete</Text></TouchableOpacity>}
          </HStack>
        </HStack>

        <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
          {poll.options.map((option: any, index: number) => {
            const hasVoted = option.voterIds.includes(currentUid);
            const voteCount = option.voterIds.length;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

            return (
              <TouchableOpacity key={index} activeOpacity={isExpired ? 1 : 0.7} disabled={isExpired} onPress={() => handleVote(poll.id, index, poll.options, poll.allowMultiple)} className={`rounded-lg border overflow-hidden relative ${compact ? 'p-3' : 'p-4'} ${hasVoted ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}>
                {displayResults && <View className={`absolute top-0 bottom-0 left-0 ${hasVoted ? 'bg-blue-600/30' : 'bg-zinc-700/50'}`} style={{ width: `${pct}%` }} />}
                <HStack className="justify-between items-center z-10">
                  <Text className={`font-medium ${compact ? 'text-sm' : ''} ${hasVoted ? 'text-blue-100' : 'text-zinc-300'}`}>{option.text}</Text>
                  <Text className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${hasVoted ? 'text-blue-400' : 'text-zinc-500'}`}>{displayResults ? `${pct}% (${voteCount})` : `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`}</Text>
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
  const uniqueVoters = new Set<string>();
  polls.forEach((poll) => {
    if (poll.type === 'availability') {
      Object.keys(poll.availabilityByUser || {}).forEach((uid) => {
        if (Array.isArray(poll.availabilityByUser?.[uid]) && poll.availabilityByUser[uid].length > 0) uniqueVoters.add(uid);
      });
      return;
    }
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
                  onPress={() => setIsTimeModalOpen(true)}
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
        <TimeAvailabilityModal visible={isTimeModalOpen} eventId={id as string} onClose={() => setIsTimeModalOpen(false)} />
        <AvailabilityPickerModal visible={isAvailabilityModalOpen} poll={availabilityPoll} currentUid={currentUid} onClose={() => setIsAvailabilityModalOpen(false)} onSave={handleSaveAvailability} />
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
      <TimeAvailabilityModal visible={isTimeModalOpen} eventId={id as string} onClose={() => setIsTimeModalOpen(false)} />
      <AvailabilityPickerModal visible={isAvailabilityModalOpen} poll={availabilityPoll} currentUid={currentUid} onClose={() => setIsAvailabilityModalOpen(false)} onSave={handleSaveAvailability} />
    </Box>
  );
}