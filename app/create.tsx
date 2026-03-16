import React, { useState } from 'react';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useEvents } from '../hooks/useEvents';

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createNewEvent } = useEvents();
  const router = useRouter();

  const handleCreate = async () => {
    if (!title.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await createNewEvent({ title, description });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Box className="flex-1 bg-zinc-900 justify-center items-center px-8">
        <VStack className="gap-8 w-full max-w-sm">
          <Button
            variant="link"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/dashboard');
              }
            }}
            className="self-start p-0 mb-1"
          >
            <ButtonText className="text-blue-500">← Back</ButtonText>
          </Button>
          <VStack className="gap-2">
            <Heading size="2xl" className="text-zinc-50 text-center">What's The Plan?</Heading>
            <Text className="text-zinc-400 text-center">
              Start with the basics now. You can turn time and place into polls next.
            </Text>
          </VStack>

          <VStack className="gap-4">
            <VStack className="gap-2">
              <Text className="text-zinc-300 font-semibold ml-1">Event title</Text>
              <Input variant="outline" size="xl" className="border-zinc-700">
                <InputField
                  placeholder="e.g., Friday Night Dinner"
                  placeholderTextColor="#a1a1aa"
                  value={title}
                  onChangeText={setTitle}
                  className="text-zinc-50"
                  autoFocus
                />
              </Input>
            </VStack>

            <VStack className="gap-2">
              <Text className="text-zinc-300 font-semibold ml-1">Description (optional)</Text>
              <Input variant="outline" size="xl" className="border-zinc-700 min-h-[96px] items-start">
                <InputField
                  placeholder="Quick context, vibe, budget, or anything friends should know..."
                  placeholderTextColor="#a1a1aa"
                  value={description}
                  onChangeText={setDescription}
                  className="text-zinc-50 pt-3"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </Input>
            </VStack>

            <Button
              size="xl"
              action="primary"
              className="bg-blue-600 border-0"
              onPress={handleCreate}
              isDisabled={isCreating || !title.trim()}
            >
              <ButtonText className="font-bold text-white">
                {isCreating ? 'Creating...' : 'Create'}
              </ButtonText>
            </Button>

            <Button size="xl" variant="link" onPress={() => router.back()} isDisabled={isCreating}>
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
