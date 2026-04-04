import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Pressable, Platform, ActionSheetIOS } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebaseConfig';
import { trackEvent } from '@/utils/analytics';
import type { PollEndCondition } from '@/utils/eventItems';
import { enqueueNotificationJob } from '@/utils/notificationJobs';

type CreateItemType = 'poll' | 'role';
type Step = 0 | 1 | 2;

interface PollModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  initialQuestion?: string;
  initialChoices?: string[];
  pollIdToEdit?: string;
  linkedField?: 'time' | 'location';
}

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

function createBlankChoices(count = 2) {
  return Array.from({ length: count }, () => '');
}

export default function PollModal({ visible, eventId, onClose, initialQuestion, initialChoices, pollIdToEdit, linkedField }: PollModalProps) {
  const [step, setStep] = useState<Step>(linkedField ? 1 : 0);
  const [createType, setCreateType] = useState<CreateItemType>(linkedField ? 'poll' : 'poll');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(createBlankChoices());
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowInviteeChoices, setAllowInviteeChoices] = useState(false);
  const [endCondition, setEndCondition] = useState<PollEndCondition>('time');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [targetVoteCount, setTargetVoteCount] = useState('5');
  const [slotLimitMode, setSlotLimitMode] = useState<'limited' | 'unlimited'>('limited');
  const [slotLimit, setSlotLimit] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queueNotificationJob = async (type: 'poll_created' | 'role_created', title: string, body: string) => {
    try {
      await enqueueNotificationJob({
        eventId,
        type,
        title,
        body,
      });
    } catch (error) {
      console.error('Error queueing notification job:', error);
    }
  };

  const resetForm = () => {
    setCreateType(linkedField ? 'poll' : 'poll');
    setStep(linkedField ? 1 : 0);
    setQuestion(initialQuestion || '');
    setChoices(initialChoices && initialChoices.length > 0 ? [...initialChoices] : createBlankChoices());
    setAllowMultiple(false);
    setAllowInviteeChoices(false);
    setEndCondition('time');
    setDurationHours(24);
    setTargetVoteCount('5');
    setSlotLimitMode('limited');
    setSlotLimit('1');
    setIsDropdownOpen(false);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!visible) return;

    const loadEditingState = async () => {
      resetForm();

      if (!pollIdToEdit) return;

      try {
        const pollSnap = await getDoc(doc(db, 'events', eventId, 'polls', pollIdToEdit));
        if (!pollSnap.exists()) return;

        const pollData = pollSnap.data();
        const itemType: CreateItemType = pollData.type === 'role' ? 'role' : 'poll';
        setCreateType(itemType);
        setStep(2);
        setQuestion(pollData.question || '');
        setChoices(
          itemType === 'poll'
            ? (Array.isArray(pollData.options) && pollData.options.length > 0
                ? pollData.options.map((option: any) => option.text || '')
                : createBlankChoices())
            : [pollData.question || '']
        );
        setAllowMultiple(!!pollData.allowMultiple);
        setAllowInviteeChoices(!!pollData.allowInviteeChoices);
        setEndCondition(pollData.endCondition === 'vote_count' ? 'vote_count' : 'time');
        setDurationHours(24);
        setTargetVoteCount(pollData.targetVoteCount ? String(pollData.targetVoteCount) : '5');
        setSlotLimitMode(pollData.slotLimit == null ? 'unlimited' : 'limited');
        setSlotLimit(pollData.slotLimit != null ? String(pollData.slotLimit) : '1');
      } catch (error) {
        console.error('Error loading item for editing:', error);
      }
    };

    loadEditingState();
  }, [visible, pollIdToEdit, eventId, initialQuestion, initialChoices, linkedField]);

  const handleClearForm = () => {
    resetForm();
  };

  const getPollSettingsValid = () => {
    if (endCondition === 'time') return true;
    const parsedTarget = Number.parseInt(targetVoteCount, 10);
    return Number.isInteger(parsedTarget) && parsedTarget > 0;
  };

  const getRoleSettingsValid = () => {
    if (slotLimitMode === 'unlimited') return true;
    const parsedLimit = Number.parseInt(slotLimit, 10);
    return Number.isInteger(parsedLimit) && parsedLimit > 0;
  };

  const canContinue = () => {
    if (step === 0) {
      return !!createType;
    }

    if (step === 1) {
      return createType === 'poll' ? getPollSettingsValid() : getRoleSettingsValid();
    }

    if (createType === 'poll') {
      return !!question.trim() && choices.filter((choice) => choice.trim()).length >= 2 && choices.every((choice) => choice.trim());
    }

    return !!question.trim();
  };

  const handleSave = async () => {
    if (isSubmitting || !canContinue()) return;
    setIsSubmitting(true);

    try {
      if (createType === 'poll') {
        const expiresAt = endCondition === 'time'
          ? (() => {
              const nextExpiry = new Date();
              nextExpiry.setHours(nextExpiry.getHours() + durationHours);
              return nextExpiry;
            })()
          : null;
        const parsedTargetVoteCount = endCondition === 'vote_count' ? Number.parseInt(targetVoteCount, 10) : null;

        if (pollIdToEdit) {
          const pollRef = doc(db, 'events', eventId, 'polls', pollIdToEdit);
          const pollDoc = await getDoc(pollRef);
          const oldOptions = pollDoc.exists() ? pollDoc.data().options : [];
          const existingLinkedField = pollDoc.exists() ? pollDoc.data().linkedField : undefined;

          const updatedOptions = choices.map((choice, index) => ({
            text: choice.trim(),
            voterIds: oldOptions[index] ? oldOptions[index].voterIds : [],
          }));

          await updateDoc(pollRef, {
            type: 'poll',
            question: question.trim(),
            allowMultiple,
            allowInviteeChoices,
            options: updatedOptions,
            expiresAt,
            endCondition,
            targetVoteCount: parsedTargetVoteCount,
            linkedField: linkedField ?? existingLinkedField ?? null,
            slotLimit: null,
          });

          trackEvent('poll_updated', {
            event_id: eventId,
            poll_id: pollIdToEdit,
            linked_field: linkedField ?? existingLinkedField ?? 'none',
            option_count: updatedOptions.length,
          });
        } else {
          const pollDoc = await addDoc(collection(db, 'events', eventId, 'polls'), {
            type: 'poll',
            question: question.trim(),
            allowMultiple,
            allowInviteeChoices,
            options: choices.map((choice) => ({ text: choice.trim(), voterIds: [] })),
            createdAt: serverTimestamp(),
            status: 'active',
            expiresAt,
            endCondition,
            targetVoteCount: parsedTargetVoteCount,
            ...(linkedField ? { linkedField } : {}),
          });

          trackEvent('poll_created', {
            event_id: eventId,
            poll_id: pollDoc.id,
            linked_field: linkedField ?? 'none',
            option_count: choices.length,
          });
        }

        await queueNotificationJob('poll_created', 'New Poll Available!', question.trim());
      } else {
        const parsedSlotLimit = slotLimitMode === 'limited' ? Number.parseInt(slotLimit, 10) : null;

        if (pollIdToEdit) {
          const roleRef = doc(db, 'events', eventId, 'polls', pollIdToEdit);
          const roleDoc = await getDoc(roleRef);
          const existingAssignees = roleDoc.exists() ? (roleDoc.data().options?.[0]?.voterIds || []) : [];

          if (parsedSlotLimit != null && existingAssignees.length > parsedSlotLimit) {
            alert('That slot count is lower than the number of people who already claimed this role.');
            setIsSubmitting(false);
            return;
          }

          await updateDoc(roleRef, {
            type: 'role',
            question: question.trim(),
            allowMultiple: false,
            allowInviteeChoices: false,
            options: [{ text: question.trim(), voterIds: existingAssignees }],
            expiresAt: null,
            endCondition: null,
            targetVoteCount: null,
            slotLimit: parsedSlotLimit,
            linkedField: null,
          });

          trackEvent('role_updated', {
            event_id: eventId,
            poll_id: pollIdToEdit,
            slot_limit: parsedSlotLimit ?? 'unlimited',
          });
        } else {
          const roleDoc = await addDoc(collection(db, 'events', eventId, 'polls'), {
            type: 'role',
            question: question.trim(),
            allowMultiple: false,
            allowInviteeChoices: false,
            options: [{ text: question.trim(), voterIds: [] }],
            createdAt: serverTimestamp(),
            status: 'active',
            expiresAt: null,
            endCondition: null,
            targetVoteCount: null,
            slotLimit: parsedSlotLimit,
            linkedField: null,
          });

          trackEvent('role_created', {
            event_id: eventId,
            poll_id: roleDoc.id,
            slot_limit: parsedSlotLimit ?? 'unlimited',
          });
        }

        await queueNotificationJob('role_created', 'New Role Available!', `${question.trim()} is now open to claim.`);
      }

      handleClearForm();
      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
      alert(`Something went wrong saving your ${createType}. Try again.`);
      setIsSubmitting(false);
    }
  };

  const handleDurationPress = () => {
    if (Platform.OS === 'ios') {
      const options = [...DURATION_OPTIONS.map((option) => option.label), 'Cancel'];
      const cancelButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Select Poll Duration',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            setDurationHours(DURATION_OPTIONS[buttonIndex].value);
          }
        }
      );
      return;
    }

    setIsDropdownOpen(true);
  };

  const renderStepPicker = () => (
    <VStack className="gap-3">
      <Text className="text-zinc-300 font-bold ml-1">What are you creating?</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        className={`p-4 rounded-2xl border ${createType === 'poll' ? 'bg-blue-600/10 border-blue-500' : 'bg-zinc-800 border-zinc-700'}`}
        onPress={() => setCreateType('poll')}
      >
        <Text className={`font-bold text-lg ${createType === 'poll' ? 'text-blue-300' : 'text-zinc-50'}`}>Poll</Text>
        <Text className="text-zinc-400 text-sm mt-1">Let the group vote on a question with options.</Text>
      </TouchableOpacity>

      {!linkedField && !pollIdToEdit && (
        <TouchableOpacity
          activeOpacity={0.8}
          className={`p-4 rounded-2xl border ${createType === 'role' ? 'bg-amber-500/10 border-amber-500' : 'bg-zinc-800 border-zinc-700'}`}
          onPress={() => setCreateType('role')}
        >
          <Text className={`font-bold text-lg ${createType === 'role' ? 'text-amber-300' : 'text-zinc-50'}`}>Role</Text>
          <Text className="text-zinc-400 text-sm mt-1">Let people claim spots like driver, grill master, or DJ.</Text>
        </TouchableOpacity>
      )}
    </VStack>
  );

  const renderPollSettings = () => (
    <VStack className="gap-5">
      <VStack className="gap-2">
        <Text className="text-zinc-300 font-bold ml-1">How should this poll end?</Text>
        <HStack className="gap-3">
          {(['time', 'vote_count'] as PollEndCondition[]).map((value) => (
            <TouchableOpacity
              key={value}
              activeOpacity={0.8}
              className={`flex-1 rounded-xl border p-4 ${endCondition === value ? 'border-blue-500 bg-blue-600/10' : 'border-zinc-700 bg-zinc-800'}`}
              onPress={() => setEndCondition(value)}
            >
              <Text className={`font-bold ${endCondition === value ? 'text-blue-300' : 'text-zinc-100'}`}>
                {value === 'time' ? 'By Time' : 'By Vote Count'}
              </Text>
              <Text className="text-zinc-400 text-xs mt-1">
                {value === 'time' ? 'Close automatically after a set duration.' : 'Close once enough people have voted.'}
              </Text>
            </TouchableOpacity>
          ))}
        </HStack>
      </VStack>

      {endCondition === 'time' ? (
        <VStack className="gap-2">
          <Text className="text-zinc-300 font-bold ml-1">Poll Duration</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center"
            onPress={handleDurationPress}
          >
            <Text className="text-zinc-50 font-medium text-base">
              {DURATION_OPTIONS.find((option) => option.value === durationHours)?.label}
            </Text>
            <Text className="text-zinc-400 text-xs">Select</Text>
          </TouchableOpacity>
        </VStack>
      ) : (
        <VStack className="gap-2">
          <Text className="text-zinc-300 font-bold ml-1">Vote Count Goal</Text>
          <Input variant="outline" size="xl" className="border-zinc-700">
            <InputField
              value={targetVoteCount}
              keyboardType="number-pad"
              onChangeText={setTargetVoteCount}
              placeholder="How many voters should finish it?"
              placeholderTextColor="#71717a"
              className="text-zinc-50"
            />
          </Input>
        </VStack>
      )}

      <HStack className="justify-between items-center bg-zinc-800 p-4 rounded-xl border border-zinc-700">
        <VStack className="flex-1 pr-4">
          <Text className="text-zinc-50 font-bold">Allow Multiple Choices</Text>
          <Text className="text-zinc-400 text-xs mt-1">Let people choose more than one option.</Text>
        </VStack>
        <Switch
          value={allowMultiple}
          onValueChange={setAllowMultiple}
          trackColor={{ false: '#3f3f46', true: '#2563eb' }}
        />
      </HStack>

      <HStack className="justify-between items-center bg-zinc-800 p-4 rounded-xl border border-zinc-700">
        <VStack className="flex-1 pr-4">
          <Text className="text-zinc-50 font-bold">Invitees Can Add Choices</Text>
          <Text className="text-zinc-400 text-xs mt-1">Let non-organizers suggest new options directly in the poll.</Text>
        </VStack>
        <Switch
          value={allowInviteeChoices}
          onValueChange={setAllowInviteeChoices}
          trackColor={{ false: '#3f3f46', true: '#2563eb' }}
        />
      </HStack>
    </VStack>
  );

  const renderRoleSettings = () => (
    <VStack className="gap-5">
      <VStack className="gap-2">
        <Text className="text-zinc-300 font-bold ml-1">How many people can take this role?</Text>
        <HStack className="gap-3">
          {(['limited', 'unlimited'] as const).map((value) => (
            <TouchableOpacity
              key={value}
              activeOpacity={0.8}
              className={`flex-1 rounded-xl border p-4 ${slotLimitMode === value ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-800'}`}
              onPress={() => setSlotLimitMode(value)}
            >
              <Text className={`font-bold ${slotLimitMode === value ? 'text-amber-300' : 'text-zinc-100'}`}>
                {value === 'limited' ? 'Limited' : 'Unlimited'}
              </Text>
              <Text className="text-zinc-400 text-xs mt-1">
                {value === 'limited' ? 'Close the role when all slots are claimed.' : 'Let anyone in the event take it.'}
              </Text>
            </TouchableOpacity>
          ))}
        </HStack>
      </VStack>

      {slotLimitMode === 'limited' && (
        <VStack className="gap-2">
          <Text className="text-zinc-300 font-bold ml-1">Slot Count</Text>
          <Input variant="outline" size="xl" className="border-zinc-700">
            <InputField
              value={slotLimit}
              keyboardType="number-pad"
              onChangeText={setSlotLimit}
              placeholder="How many spots are available?"
              placeholderTextColor="#71717a"
              className="text-zinc-50"
            />
          </Input>
        </VStack>
      )}
    </VStack>
  );

  const renderDetails = () => {
    if (createType === 'role') {
      return (
        <VStack className="gap-6">
          <VStack className="gap-2">
            <Text className="text-zinc-300 font-bold ml-1">Role Name</Text>
            <Input variant="outline" size="xl" className="border-zinc-700">
              <InputField
                placeholder="e.g., Driver, Grill Master, Snack Runner"
                placeholderTextColor="#a1a1aa"
                className="text-zinc-50"
                value={question}
                onChangeText={setQuestion}
              />
            </Input>
          </VStack>

          <View className="rounded-2xl border border-zinc-700 bg-zinc-800 p-4">
            <Text className="text-zinc-200 font-semibold">Role summary</Text>
            <Text className="text-zinc-400 text-sm mt-2">
              {slotLimitMode === 'unlimited'
                ? 'Anyone in the event can claim this role.'
                : `${slotLimit || '0'} ${slotLimit === '1' ? 'person can' : 'people can'} claim this role before it closes.`}
            </Text>
          </View>
        </VStack>
      );
    }

    return (
      <VStack className="gap-6">
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

        <VStack className="gap-3">
          <Text className="text-zinc-300 font-bold ml-1">Choices</Text>
          {choices.map((choice, index) => (
            <Input key={index} variant="outline" size="xl" className="border-zinc-700">
              <InputField
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#52525b"
                className="text-zinc-50"
                value={choice}
                onChangeText={(text) => {
                  const updated = [...choices];
                  updated[index] = text;
                  setChoices(updated);
                }}
              />
            </Input>
          ))}
          <Button
            variant="outline"
            action="secondary"
            className="border-zinc-700 border-dashed mt-2"
            onPress={() => setChoices([...choices, ''])}
          >
            <ButtonText className="text-zinc-400 font-bold">+ Add Another Option</ButtonText>
          </Button>
        </VStack>
      </VStack>
    );
  };

  const title = pollIdToEdit
    ? `Edit ${createType === 'role' ? 'Role' : 'Poll'}`
    : createType === 'role'
      ? 'Create'
      : 'Create';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-md max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-6">
            <VStack className="gap-1">
              <Heading size="xl" className="text-zinc-50">{title}</Heading>
              <Text className="text-zinc-400 text-xs uppercase tracking-wider">Step {step + 1} of 3</Text>
            </VStack>
            <HStack className="gap-2">
              <Button size="sm" variant="link" onPress={handleClearForm}>
                <ButtonText className="text-red-400 font-semibold">Clear</ButtonText>
              </Button>
              <Button size="sm" variant="link" onPress={onClose}>
                <ButtonText className="text-zinc-400">Cancel</ButtonText>
              </Button>
            </HStack>
          </HStack>

          <HStack className="gap-2 mb-6">
            {[0, 1, 2].map((stepIndex) => (
              <View
                key={stepIndex}
                className="flex-1 h-2.5 rounded-full border"
                style={
                  stepIndex <= step
                    ? {
                        backgroundColor: '#22d3ee',
                        borderColor: '#67e8f9',
                      }
                    : {
                        backgroundColor: '#3f3f46',
                        borderColor: '#52525b',
                      }
                }
              />
            ))}
          </HStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack className="gap-6 pb-2">
              {step === 0 && renderStepPicker()}
              {step === 1 && (createType === 'poll' ? renderPollSettings() : renderRoleSettings())}
              {step === 2 && renderDetails()}

              <HStack className="justify-between gap-3 mt-2 mb-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 border-zinc-700 bg-zinc-800"
                  onPress={() => {
                    if (step === 0) {
                      onClose();
                      return;
                    }
                    if (pollIdToEdit && step === 1) {
                      onClose();
                      return;
                    }
                    if (pollIdToEdit && step === 2) {
                      setStep(1);
                      return;
                    }
                    setStep((current) => Math.max(0, current - 1) as Step);
                  }}
                >
                  <ButtonText className="text-zinc-200 font-bold" style={{ color: '#e4e4e7' }}>
                    {step === 0 ? 'Cancel' : 'Back'}
                  </ButtonText>
                </Button>

                {step < 2 ? (
                  <Button
                    size="lg"
                    action="primary"
                    className="flex-1 bg-blue-600 border-0"
                    onPress={() => setStep((current) => Math.min(2, current + 1) as Step)}
                    isDisabled={!canContinue()}
                  >
                    <ButtonText className="font-bold text-white">Continue</ButtonText>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    action="primary"
                    className="flex-1 border-0"
                    style={{ backgroundColor: createType === 'role' ? '#f59e0b' : '#2563eb' }}
                    onPress={handleSave}
                    isDisabled={isSubmitting || !canContinue()}
                  >
                    <ButtonText className="font-bold text-white">
                      {isSubmitting ? 'Saving...' : pollIdToEdit ? 'Save Changes' : createType === 'role' ? 'Create Role' : 'Publish Poll'}
                    </ButtonText>
                  </Button>
                )}
              </HStack>
            </VStack>
          </ScrollView>
        </View>

        {Platform.OS !== 'ios' && isDropdownOpen && (
          <View className="absolute top-0 bottom-0 left-0 right-0 justify-center items-center z-50">
            <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/60" onPress={() => setIsDropdownOpen(false)} />
            <View className="bg-zinc-800 rounded-2xl p-2 border border-zinc-700 shadow-2xl w-64 z-10">
              <Text className="text-zinc-400 font-bold text-xs uppercase tracking-wider text-center mt-3 mb-2">Select Duration</Text>
              <ScrollView className="max-h-64" showsVerticalScrollIndicator={false}>
                {DURATION_OPTIONS.map((option) => {
                  const isSelected = durationHours === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      className={`p-3 rounded-xl ${isSelected ? 'bg-zinc-700/50' : ''}`}
                      onPress={() => {
                        setDurationHours(option.value);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <Text className={`text-center text-base ${isSelected ? 'text-blue-400 font-bold' : 'text-zinc-300 font-medium'}`}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Button variant="link" className="mt-1" onPress={() => setIsDropdownOpen(false)}>
                <ButtonText className="text-zinc-400">Cancel</ButtonText>
              </Button>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
