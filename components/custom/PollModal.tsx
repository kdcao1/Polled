import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig'; // Adjust path if needed

interface PollModalProps {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  initialQuestion?: string;
  initialChoices?: string[];
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

export default function PollModal({ visible, eventId, onClose, initialQuestion, initialChoices }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);

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
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
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
                  <Text className="text-zinc-400 text-xs">{isDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

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
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.7}
                        className={`flex-row justify-between items-center p-5 ${!isLast ? 'border-b border-zinc-700/50' : ''}`}
                        onPress={() => {
                          setDurationHours(option.value);
                          setTimeout(() => setIsDropdownOpen(false), 200); 
                        }}
                      >
                        <Text className={`text-base ${isSelected ? 'text-zinc-50 font-medium' : 'text-zinc-300'}`}>{option.label}</Text>
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-zinc-500'}`}>
                          {isSelected && <View className="w-3 h-3 rounded-full bg-indigo-500" />}
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