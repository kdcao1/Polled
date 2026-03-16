import React from 'react';
import { View, Modal, Pressable, Platform } from 'react-native';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import QRCode from 'react-native-qrcode-svg';

interface QRModalProps {
  visible: boolean;
  onClose: () => void;
  eventData: any;
  joinLink: string;
}

export default function QRModal({ visible, onClose, eventData, joinLink }: QRModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        <View className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 items-center shadow-2xl z-10 w-full max-w-[320px]">
          <Heading size="xl" className="text-zinc-50 mb-1 text-center">Scan to Join</Heading>
          <Text className="text-zinc-400 mb-8 text-center" {...(Platform.OS !== 'web' ? { numberOfLines: 2 } : {})}>
            {eventData?.title}
          </Text>
          
          <View className="bg-white p-4 rounded-2xl mb-6 min-h-[232px] min-w-[232px] justify-center items-center">
             {joinLink ? (
               <QRCode value={joinLink} size={200} backgroundColor="white" color="black" />
             ) : (
               <Text className="text-zinc-400">Loading QR...</Text>
             )}
          </View>

          <Text className="text-zinc-500 font-mono tracking-widest font-bold mb-6">
            CODE: {eventData?.joinCode}
          </Text>

          <Button size="md" variant="outline" className="border-zinc-700 w-full bg-zinc-800" onPress={onClose}>
            <ButtonText className="text-zinc-300 font-bold">Close</ButtonText>
          </Button>
        </View>
      </View>
    </Modal>
  );
}