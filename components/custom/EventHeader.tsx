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

interface EventHeaderProps {
  eventData: any;
  headcount: number;
  isMobile: boolean;
  isOrganizer: boolean;
  joinLink: string;
  onBack: () => void;
  onShowQR: () => void;
  onOpenModal: (question: string) => void;
  onShowParticipants: () => void;
}

export default function EventHeader({ eventData, headcount, isMobile, isOrganizer, joinLink, onBack, onShowQR, onOpenModal, onShowParticipants }: EventHeaderProps) {
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
          <Heading size="sm" className="text-zinc-400 uppercase tracking-wider mb-3">Event Details</Heading>
          
          <VStack className="gap-3">
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Status</Text>
              <Text className="text-green-400 font-bold">{eventData?.status === 'voting' ? 'Active' : 'Closed'}</Text>
            </HStack>

            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Time</Text>
              {!eventData?.time && isOrganizer ? (
                <Button size="xs" variant="outline" className="border-zinc-600 bg-zinc-800 h-7 px-2" onPress={() => onOpenModal('What time?')}>
                  <ButtonText className="text-zinc-300 text-xs">Poll Time</ButtonText>
                </Button>
              ) : (
                <Text className="text-zinc-50 font-semibold">{eventData?.time || 'TBD'}</Text>
              )}
            </HStack>
            
            <HStack className="justify-between gap-6 items-center">
              <Text className="text-zinc-400 font-medium">Location</Text>
              {!eventData?.location && isOrganizer ? (
                <Button size="xs" variant="outline" className="border-zinc-600 bg-zinc-800 h-7 px-2" onPress={() => onOpenModal('Where we going?')}>
                  <ButtonText className="text-zinc-300 text-xs">Poll Location</ButtonText>
                </Button>
              ) : (
                <Text className="text-zinc-50 font-semibold text-right max-w-[140px]" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
                  {eventData?.location || 'TBD'}
                </Text>
              )}
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