import React, { useState } from 'react';
import { Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { CalendarPlus } from 'lucide-react-native';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getCalendarEventDetails, openCalendarEvent } from '@/utils/calendarLinks';

type CalendarProvider = 'google' | 'apple';

type CalendarModalProps = {
  visible: boolean;
  eventData: any;
  joinLink: string;
  onClose: () => void;
  onSelect?: (provider: CalendarProvider) => void;
};

export default function CalendarModal({
  visible,
  eventData,
  joinLink,
  onClose,
  onSelect,
}: CalendarModalProps) {
  const [isOpening, setIsOpening] = useState<CalendarProvider | null>(null);
  const { width } = useWindowDimensions();
  const calendarEvent = getCalendarEventDetails({ eventData, joinLink });
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  const handleOpenCalendar = async (provider: CalendarProvider) => {
    setIsOpening(provider);

    try {
      const didOpen = await openCalendarEvent(provider, { eventData, joinLink });
      if (didOpen) {
        onSelect?.(provider);
        onClose();
      }
    } catch (error) {
      console.error('Error opening calendar:', error);
    } finally {
      setIsOpening(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <Box className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-2xl z-10 w-full max-w-[340px]">
          <VStack className="gap-4">
            <View className="items-center">
              <View className="h-12 w-12 rounded-full bg-blue-500/15 border border-blue-500/30 items-center justify-center mb-3">
                <CalendarPlus size={24} color="#60a5fa" />
              </View>
              <Heading size="xl" className="text-zinc-50 text-center">Add to Calendar</Heading>
              <Text className="text-zinc-400 text-center mt-2">
                {calendarEvent
                  ? calendarEvent.title
                  : 'Set a valid event time before adding it to a calendar.'}
              </Text>
            </View>

            <VStack className="gap-3">
              <Button
                size="lg"
                action="primary"
                className="bg-blue-600 border-0"
                isDisabled={!calendarEvent || isOpening !== null}
                onPress={() => handleOpenCalendar('google')}
              >
                <ButtonText className="text-white font-bold">
                  {isOpening === 'google' ? 'Opening...' : 'Google Calendar'}
                </ButtonText>
              </Button>

              {!isDesktopWeb && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-zinc-700 bg-zinc-800"
                  isDisabled={!calendarEvent || isOpening !== null}
                  onPress={() => handleOpenCalendar('apple')}
                >
                  <ButtonText className="text-zinc-50 font-bold">
                    {isOpening === 'apple'
                      ? 'Opening...'
                      : Platform.OS === 'web'
                        ? 'Apple Calendar'
                        : Platform.OS === 'ios'
                          ? 'Apple Calendar'
                          : 'Calendar File (.ics)'}
                  </ButtonText>
                </Button>
              )}
            </VStack>

            <Button size="md" variant="link" onPress={onClose}>
              <ButtonText className="text-zinc-400 font-semibold">Cancel</ButtonText>
            </Button>
          </VStack>
        </Box>
      </View>
    </Modal>
  );
}
