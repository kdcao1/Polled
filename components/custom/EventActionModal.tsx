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
  onClose: () => void;
  onEdit: (eventId: string) => void;
  onConfirmAction: () => void;
};

export default function EventActionModal({ 
  event, 
  currentUid, 
  isDeleting, 
  onClose, 
  onEdit, 
  onConfirmAction 
}: Props) {
  
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!event) {
      setShowConfirm(false);
    }
  }, [event]);

  if (!event) return null;

  const isOrganizer = event.organizerId === currentUid;

  const handleClose = () => {
    setShowConfirm(false);
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
            <Text className={`text-sm ${showConfirm ? 'text-red-400 font-bold' : 'text-zinc-400'}`}>
              {showConfirm ? 'Are you absolutely sure?' : (isOrganizer ? 'Manage your event' : 'Event options')}
            </Text>
          </VStack>

          <VStack className="gap-3 mt-2">
            
            {!showConfirm ? (
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

                <Button 
                  size="xl" 
                  variant="outline" 
                  className="border-red-500/30 bg-red-500/10 w-full" 
                  onPress={() => setShowConfirm(true)}
                  isDisabled={isDeleting}
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
                  className="bg-red-600 border-0 w-full" 
                  onPress={onConfirmAction}
                  isDisabled={isDeleting}
                >
                  {isDeleting ? <ButtonSpinner color="white" /> : (
                    <ButtonText className="font-bold text-white">
                      Yes, {isOrganizer ? 'Delete' : 'Leave'}
                    </ButtonText>
                  )}
                </Button>

                <Button 
                  size="xl" 
                  variant="outline" 
                  className="border-zinc-600 bg-zinc-800 w-full" 
                  onPress={() => setShowConfirm(false)}
                  isDisabled={isDeleting}
                >
                  <ButtonText className="font-bold text-zinc-50">Nevermind</ButtonText>
                </Button>
              </>
            )}

          </VStack>

          {!showConfirm && (
            <Button 
              size="md" 
              variant="link" 
              className="mt-2"
              onPress={handleClose}
              isDisabled={isDeleting}
            >
              <ButtonText className="text-zinc-400">Cancel</ButtonText>
            </Button>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}