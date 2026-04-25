import React, { useState, useEffect } from 'react';
import { Modal, Pressable } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { EventData } from '../../hooks/useDashboard';

type Props = {
  event: EventData | null;
  currentUid: string | undefined;
  isDeleting: boolean;
  isEnding: boolean;
  isRestarting: boolean;
  onClose: () => void;
  onEdit: (eventId: string) => void;
  onConfirmAction: () => void;
  onEndEvent: () => void;
  onRestartEvent: () => void;
};

export default function EventActionModal({ 
  event, 
  currentUid, 
  isDeleting, 
  isEnding,
  isRestarting,
  onClose, 
  onEdit, 
  onConfirmAction,
  onEndEvent,
  onRestartEvent,
}: Props) {
  
  const [confirmMode, setConfirmMode] = useState<'remove' | 'end' | 'restart' | null>(null);

  useEffect(() => {
    if (!event) {
      setConfirmMode(null);
    }
  }, [event]);

  if (!event) return null;

  const isOrganizer = event.organizerId === currentUid;
  const isEnded = event.status === 'ended';
  const isBusy = isDeleting || isEnding || isRestarting;

  const handleClose = () => {
    setConfirmMode(null);
    onClose();
  };

  return (
    <Modal
      visible={!!event}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* OUTER BACKDROP: Click to close */}
      <Pressable 
        className="flex-1 bg-black/70 justify-center items-center px-6"
        onPress={!isDeleting ? handleClose : undefined} 
      >
        {/* INNER CARD: Stop clicks from bubbling up to the backdrop */}
        <Pressable 
          className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl gap-6"
          onPress={(e) => e.stopPropagation()} 
        >
          
          <VStack className="gap-1 text-center items-center">
            <Heading size="xl" className="text-zinc-50">{event.title}</Heading>
            <Text className={`text-sm ${confirmMode ? 'text-red-400 font-bold' : 'text-zinc-400'}`}>
              {confirmMode ? 'Are you absolutely sure?' : (isOrganizer ? 'Manage your event' : 'Event options')}
            </Text>
          </VStack>

          <VStack className="gap-3 mt-2">
            
            {!confirmMode ? (
              <>
                {isOrganizer && (
                  <Button 
                    size="xl" 
                    variant="outline" 
                    className="border-zinc-600 bg-zinc-800 w-full" 
                    onPress={() => onEdit(event.id)}
                  >
                    <ButtonText className="font-bold text-zinc-50">Edit Details</ButtonText>
                  </Button>
                )}

                {isOrganizer && !isEnded && (
                  <Button
                    size="xl"
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 w-full"
                    onPress={() => setConfirmMode('end')}
                    isDisabled={isBusy}
                  >
                    <ButtonText className="font-bold text-amber-400">End Event</ButtonText>
                  </Button>
                )}

                {isOrganizer && isEnded && (
                  <Button
                    size="xl"
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 w-full"
                    onPress={() => setConfirmMode('restart')}
                    isDisabled={isBusy}
                  >
                    <ButtonText className="font-bold text-emerald-300">Restart Event</ButtonText>
                  </Button>
                )}

                <Button 
                  size="xl" 
                  variant="outline" 
                  className="border-red-500/30 bg-red-500/10 w-full" 
                  onPress={() => setConfirmMode('remove')}
                  isDisabled={isBusy}
                >
                  <ButtonText className="font-bold text-red-500">
                    {isOrganizer ? 'Delete Event' : 'Leave Event'}
                  </ButtonText>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="xl" 
                  action="primary" 
                  className={`${confirmMode === 'end' ? 'bg-amber-500' : confirmMode === 'restart' ? 'bg-emerald-600' : 'bg-red-600'} border-0 w-full`}
                  onPress={confirmMode === 'end' ? onEndEvent : confirmMode === 'restart' ? onRestartEvent : onConfirmAction}
                  isDisabled={isBusy}
                >
                  {isBusy ? <ButtonSpinner color="white" /> : (
                    <ButtonText className="font-bold text-white">
                      {confirmMode === 'end'
                        ? 'Yes, End Event'
                        : confirmMode === 'restart'
                          ? 'Yes, Restart Event'
                        : `Yes, ${isOrganizer ? 'Delete' : 'Leave'}`}
                    </ButtonText>
                  )}
                </Button>

                <Button 
                  size="xl" 
                  variant="outline" 
                  className="border-zinc-600 bg-zinc-800 w-full" 
                  onPress={() => setConfirmMode(null)}
                  isDisabled={isBusy}
                >
                  <ButtonText className="font-bold text-zinc-50">Nevermind</ButtonText>
                </Button>
              </>
            )}

          </VStack>

          {!confirmMode && (
            <Button 
              size="md" 
              variant="link" 
              className="mt-2"
              onPress={handleClose}
              isDisabled={isBusy}
            >
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}
