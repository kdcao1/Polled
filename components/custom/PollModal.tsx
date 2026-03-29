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
import { db } from '../../config/firebaseConfig'; // Adjust path if needed

interface PollModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  initialQuestion?: string;
  initialChoices?: string[];
  pollIdToEdit?: string;
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

export default function PollModal({ visible, eventId, onClose, initialQuestion, initialChoices, pollIdToEdit }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);

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

  const handleCreatePoll = async () => {
    if (!question.trim() || choices.some((c) => !c.trim())) return;
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      if (pollIdToEdit) {
        const pollRef = doc(db, 'events', eventId, 'polls', pollIdToEdit);
        const pollDoc = await getDoc(pollRef);
        const oldOptions = pollDoc.exists() ? pollDoc.data().options : [];
        
        const updatedOptions = choices.map((c, i) => ({
          text: c.trim(),
          voterIds: oldOptions[i] ? oldOptions[i].voterIds : []
        }));

        await updateDoc(pollRef, {
          question: question.trim(),
          allowMultiple,
          options: updatedOptions,
          expiresAt: expiresAt,
        });
      } else {
        const pollsRef = collection(db, 'events', eventId, 'polls');
        await addDoc(pollsRef, {
          question: question.trim(),
          allowMultiple,
          options: choices.map((c) => ({ text: c.trim(), voterIds: [] })),
          createdAt: serverTimestamp(),
          status: 'active',
          expiresAt: expiresAt,
        });
      }
      
      handleClearForm(); 
      onClose();
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Something went wrong saving your poll. Try again.');
    }
  };

  // --- NEW: Handle Platform-Specific Selection ---
  const handleDurationPress = () => {
    if (Platform.OS === 'ios') {
      const options = [...DURATION_OPTIONS.map(opt => opt.label), 'Cancel'];
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
    } else {
      // Opens the custom modal overlay for Web and Android
      setIsDropdownOpen(true);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-md max-h-[90%] shadow-2xl z-10">
          <HStack className="justify-between items-center mb-6">
            <Heading size="xl" className="text-zinc-50">{pollIdToEdit ? 'Edit Poll' : 'Create a Poll'}</Heading>
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

              <VStack className="gap-2 mt-2">
                <Text className="text-zinc-300 font-bold ml-1">Poll Duration</Text>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex-row justify-between items-center"
                  onPress={handleDurationPress}
                >
                  <Text className="text-zinc-50 font-medium text-base">
                    {DURATION_OPTIONS.find(opt => opt.value === durationHours)?.label}
                  </Text>
                  <Text className="text-zinc-400 text-xs">▼</Text>
                </TouchableOpacity>
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

              <Button
                size="xl"
                action="primary"
                className="bg-blue-600 border-0 mt-4 mb-4"
                onPress={handleCreatePoll}
                isDisabled={!question.trim() || choices.some((c) => !c.trim())}
              >
                <ButtonText className="font-bold text-white">{pollIdToEdit ? 'Save Changes' : 'Publish Poll'}</ButtonText>
              </Button>
            </VStack>
          </ScrollView>
        </View>

        {/* --- WEB / ANDROID DURATION MODAL OVERLAY --- */}
        {Platform.OS !== 'ios' && isDropdownOpen && (
          <View className="absolute top-0 bottom-0 left-0 right-0 justify-center items-center z-50">
            <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/60" onPress={() => setIsDropdownOpen(false)} />
            
            {/* CHANGED: Replaced w-[80%] max-w-xs with a fixed w-64 to keep it sleek and narrow */}
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