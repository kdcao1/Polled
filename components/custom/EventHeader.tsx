import React from 'react';
import { TouchableOpacity, Platform, Share } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import * as Clipboard from 'expo-clipboard';
import { Eye } from 'lucide-react-native';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { getEventStatusLabel, isEventEnded } from '@/utils/eventStatus';

interface EventHeaderProps {
  eventData: any;
  headcount: number;
  isMobile: boolean;
  isOrganizer: boolean;
  joinLink: string;
  timeQuickPoll?: any;
  locationQuickPoll?: any;
  isQuickPollExpired: (poll: any) => boolean;
  getQuickPollWinner: (poll: any) => any;
  onBack: () => void;
  onShowQR: () => void;
  onOpenModal: (question: string, linkedField?: 'time' | 'location') => void;
  onShowParticipants: () => void;
  onEditEvent: () => void;
}

export default function EventHeader({ eventData, headcount, isMobile, isOrganizer, joinLink, timeQuickPoll, locationQuickPoll, isQuickPollExpired, getQuickPollWinner, onBack, onShowQR, onOpenModal, onShowParticipants, onEditEvent }: EventHeaderProps) {
  const toast = useToast();
  const eventEnded = isEventEnded(eventData);

  const renderQuickPollValue = (field: 'time' | 'location', quickPoll?: any) => {
    const currentValue = eventData?.[field];
    if (currentValue) {
      return field === 'location' ? (
        <Text className="text-zinc-50 font-semibold text-right max-w-[140px]" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
          {currentValue}
        </Text>
      ) : (
        <Text className="text-zinc-50 font-semibold">{currentValue}</Text>
      );
    }

    if (!isOrganizer) {
      return <Text className="text-zinc-50 font-semibold">TBD</Text>;
    }

    if (eventEnded) {
      return <Text className="text-zinc-50 font-semibold">TBD</Text>;
    }

    if (quickPoll && !isQuickPollExpired(quickPoll)) {
      return (
        <Text className="text-blue-400 font-semibold text-right max-w-[160px]" {...(Platform.OS !== 'web' ? { numberOfLines: 2 } : {})}>
          Currently polling
        </Text>
      );
    }

    if (quickPoll && isQuickPollExpired(quickPoll)) {
      if (getQuickPollWinner(quickPoll)) {
        return <Text className="text-blue-400 font-semibold">Updating...</Text>;
      }

      return (
        <Button
          size="xs"
          variant="outline"
          className="border-zinc-600 bg-zinc-800 h-7 px-2"
          onPress={() => onOpenModal(field === 'time' ? 'What time?' : 'Where we going?', field)}
        >
          <ButtonText className="text-zinc-300 text-xs">Rerun Poll</ButtonText>
        </Button>
      );
    }

    return (
      <Button
        size="xs"
        variant="outline"
        className="border-zinc-600 bg-zinc-800 h-7 px-2"
        onPress={() => onOpenModal(field === 'time' ? 'What time?' : 'Where we going?', field)}
      >
        <ButtonText className="text-zinc-300 text-xs">{field === 'time' ? 'Poll Time' : 'Poll Location'}</ButtonText>
      </Button>
    );
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(joinLink);
    
    toast.show({
      placement: "top",
      render: ({ id: toastId }) => (
        <Toast nativeID={toastId} className="bg-zinc-800 border border-green-500 mt-24 px-4 py-3 rounded-xl shadow-lg">
          <VStack>
            <ToastTitle className="text-green-400 font-bold text-sm">Copied!</ToastTitle>
            <ToastDescription className="text-zinc-300 text-xs mt-0.5">Join link copied to clipboard.</ToastDescription>
          </VStack>
        </Toast>
      ),
    });
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

  return (
    <VStack className="gap-2 mb-6">
      <Button variant="link" onPress={onBack} className="self-start p-0 mb-1">
        <ButtonText className="text-blue-500">← Back</ButtonText>
      </Button>

      <HStack className="justify-between items-start w-full flex-wrap gap-4">
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

          <HStack className="items-center gap-4 mt-3">
             <TouchableOpacity onPress={handleCopyLink} className="flex-row items-center gap-1.5 active:opacity-70">
               <Text className="text-blue-400 font-semibold text-sm">Copy Share Link</Text>
             </TouchableOpacity>
             
             <TouchableOpacity onPress={onShowQR} className="flex-row items-center gap-1.5 active:opacity-70">
               <Text className="text-blue-400 font-semibold text-sm">Show QR Code</Text>
             </TouchableOpacity>

             {Platform.OS !== 'web' && isMobile && (
               <TouchableOpacity onPress={handleShare} className="flex-row items-center gap-1.5 active:opacity-70">
                 <Text className="text-blue-400 font-semibold text-sm">Share</Text>
               </TouchableOpacity>
             )}
          </HStack>
        </VStack>

        <VStack className={`bg-zinc-800 rounded-2xl p-5 border border-zinc-700 ${isMobile ? 'w-full mt-2' : 'min-w-[240px]'}`}>
          <HStack className="justify-between items-center mb-3">
            <Heading size="sm" className="text-zinc-400 uppercase tracking-wider">Event Details</Heading>
            {isOrganizer && (
              <HStack className="gap-2">
                <Button size="xs" variant="outline" className="border-zinc-600 bg-zinc-800 h-7 px-2" onPress={onEditEvent}>
                  <ButtonText className="text-zinc-300 text-xs">Edit</ButtonText>
                </Button>
              </HStack>
            )}
          </HStack>
          
          <VStack className="gap-3">
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Status</Text>
              <Text className={`font-bold ${eventData?.status === 'voting' ? 'text-green-400' : 'text-red-300'}`}>{getEventStatusLabel(eventData)}</Text>
            </HStack>

            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Time</Text>
              {renderQuickPollValue('time', timeQuickPoll)}
            </HStack>
            
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Location</Text>
              {renderQuickPollValue('location', locationQuickPoll)}
            </HStack>

            <HStack className="justify-between gap-6 items-center">
              <HStack className="items-center gap-2">
                <Text className="text-zinc-400 font-medium">Going</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={onShowParticipants} className="p-1.5 bg-zinc-700/50 rounded-md border border-zinc-600/50">
                  <Eye size={16} color="#a1a1aa" />
                </TouchableOpacity>
              </HStack>
              <Text className="text-zinc-50 font-semibold">{headcount} {headcount === 1 ? 'person' : 'people'}</Text>
            </HStack>
          </VStack>
        </VStack>
      </HStack>
    </VStack>
  );
}
