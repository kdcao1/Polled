import React, { useState, useEffect } from 'react';
import { Modal, Pressable } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';

export default function PollActionModal({ 
  poll,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onEndEarly,
  onRerun
}: any) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowConfirmDelete(false);
      setShowConfirmEnd(false);
    }
  }, [isOpen]);

  if (!isOpen || !poll) return null;

  const isExpired = poll.expiresAt && new Date() > (poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt));

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70 justify-center items-center px-6" onPress={onClose}>
        <Pressable className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl gap-4" onPress={(e) => e.stopPropagation()}>
          
          {!showConfirmDelete && !showConfirmEnd ? (
            <>
              <VStack className="gap-1 mb-2 items-center text-center">
                <Heading size="xl" className="text-zinc-50">Poll Options</Heading>
                <Text className="text-zinc-400 text-sm" numberOfLines={1}>"{poll.question}"</Text>
              </VStack>
              <Button size="xl" variant="outline" className="border-zinc-600 bg-zinc-800 w-full" onPress={() => { onClose(); onEdit(poll); }}>
                <ButtonText className="font-bold text-zinc-50">Edit Poll</ButtonText>
              </Button>
              <Button size="xl" variant="outline" className="border-zinc-600 bg-zinc-800 w-full" onPress={() => { onClose(); onRerun(poll); }}>
                <ButtonText className="font-bold text-zinc-50">Rerun Poll</ButtonText>
              </Button>
              {!isExpired && (
                <Button size="xl" variant="outline" className="border-zinc-600 bg-zinc-800 w-full" onPress={() => setShowConfirmEnd(true)}>
                  <ButtonText className="font-bold text-zinc-50">End Early</ButtonText>
                </Button>
              )}
              <Button size="xl" variant="outline" className="border-red-500/30 bg-red-500/10 w-full" onPress={() => setShowConfirmDelete(true)}>
                <ButtonText className="font-bold text-red-500">Delete Poll</ButtonText>
              </Button>
              <Button size="md" variant="link" className="mt-2" onPress={onClose}>
                <ButtonText className="text-zinc-400">Cancel</ButtonText>
              </Button>
            </>
          ) : showConfirmDelete ? (
            <>
              <Heading size="xl" className="text-zinc-50 mb-2 text-center text-red-400">Delete Poll?</Heading>
              <Text className="text-center text-zinc-400 mb-4">This action cannot be undone.</Text>
              <Button size="xl" action="primary" className="bg-red-600 border-0 w-full" onPress={() => { onClose(); onDelete(poll); }}>
                <ButtonText className="font-bold text-white">Yes, Delete</ButtonText>
              </Button>
              <Button size="xl" variant="outline" className="border-zinc-600 bg-zinc-800 w-full" onPress={() => setShowConfirmDelete(false)}>
                <ButtonText className="font-bold text-zinc-50">Nevermind</ButtonText>
              </Button>
            </>
          ) : (
            <>
              <Heading size="xl" className="text-zinc-50 mb-2 text-center">End Poll Early?</Heading>
              <Text className="text-center text-zinc-400 mb-4">This will stop accepting new votes and show final results immediately.</Text>
              <Button size="xl" action="primary" className="bg-blue-600 border-0 w-full" onPress={() => { onClose(); onEndEarly(poll); }}>
                <ButtonText className="font-bold text-white">Yes, End Now</ButtonText>
              </Button>
              <Button size="xl" variant="outline" className="border-zinc-600 bg-zinc-800 w-full" onPress={() => setShowConfirmEnd(false)}>
                <ButtonText className="font-bold text-zinc-50">Nevermind</ButtonText>
              </Button>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}