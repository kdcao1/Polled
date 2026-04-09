import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { annotateParticipants, type ParticipantRecord } from '@/utils/participantIdentity';
import { trackEvent } from '@/utils/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
  participantIds: string[];
  roleAssignments?: Record<string, string[]>;
  organizerId?: string | null;
  eventId?: string;
}

export default function ParticipantsModal({ visible, onClose, participantIds, roleAssignments = {}, organizerId, eventId }: Props) {
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'people' | 'roles'>('people');

  const currentUid = auth.currentUser?.uid;
  const displayParticipants = annotateParticipants(participants, currentUid);
  const rolesSummary = Object.entries(roleAssignments)
    .reduce<Record<string, string[]>>((acc, [participantId, roles]) => {
      roles.forEach((roleName) => {
        acc[roleName] = [...(acc[roleName] || []), participantId];
      });
      return acc;
    }, {});

  const participantNamesById = participants.reduce<Record<string, string>>((acc, participant) => {
    acc[participant.id] = participant.name;
    return acc;
  }, {});

  const sortedRoles = Object.entries(rolesSummary).sort(([a], [b]) => a.localeCompare(b));

  useEffect(() => {
    if (!visible) return;
    
    const fetchParticipants = async () => {
      setLoading(true);
      try {
        const safeParticipantIds = Array.isArray(participantIds) ? participantIds : [];
        
        const fetched = await Promise.all(
          safeParticipantIds.map(async (uid) => {
            try {
              const profileDoc = await getDoc(doc(db, 'profiles', uid));
              if (profileDoc.exists()) {
                return {
                  id: uid,
                  name: profileDoc.data().displayName || 'Anonymous User'
                };
              }

              const userDoc = await getDoc(doc(db, 'users', uid));
              return {
                id: uid,
                name: userDoc.exists() ? (userDoc.data().displayName || 'Anonymous User') : 'Unknown User'
              };
            } catch (participantError) {
              console.error(`Error fetching participant ${uid}:`, participantError);
              return {
                id: uid,
                name: 'Unknown User'
              };
            }
          })
        );

        fetched.sort((a, b) => a.name.localeCompare(b.name));
        setParticipants(fetched);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [visible, participantIds]);

  useEffect(() => {
    if (visible) {
      setActiveTab('people');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && activeTab === 'roles' && eventId) {
      trackEvent('roles_tab_opened', { event_id: eventId });
    }
  }, [activeTab, visible, eventId]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center p-4">
        <Pressable className="absolute top-0 bottom-0 left-0 right-0 bg-black/80" onPress={onClose} />
        
        <View className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 w-full max-w-sm max-h-[80%] shadow-2xl z-10 flex-col">
          <Heading size="xl" className="text-zinc-50 mb-4 text-center">Participants</Heading>

          <HStack className="bg-zinc-800 rounded-xl p-1 mb-4 border border-zinc-700">
            <Pressable
              onPress={() => setActiveTab('people')}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'people' ? 'bg-zinc-600' : ''}`}
            >
              <Text className={`text-xs font-semibold ${activeTab === 'people' ? 'text-zinc-50' : 'text-zinc-400'}`}>
                People
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('roles')}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'roles' ? 'bg-zinc-600' : ''}`}
            >
              <Text className={`text-xs font-semibold ${activeTab === 'roles' ? 'text-zinc-50' : 'text-zinc-400'}`}>
                Roles
              </Text>
            </Pressable>
          </HStack>
          
          {loading ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : participants.length === 0 ? (
            <Text className="text-zinc-400 text-center py-4 mb-4">No participants yet.</Text>
          ) : activeTab === 'people' ? (
            <ScrollView 
              className="w-full mb-4 shrink" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <VStack className="gap-2">
                {displayParticipants.map((participant) => {
                  const participantRoles = roleAssignments[participant.id] || [];
                  const visibleRoles = participantRoles.slice(0, 2);
                  const overflowCount = Math.max(participantRoles.length - visibleRoles.length, 0);

                  return (
                    <HStack
                      key={participant.id}
                      className="bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-700/50 items-center gap-3"
                      style={participant.isCurrentUser ? {
                        backgroundColor: 'rgba(23, 37, 84, 0.35)',
                        borderColor: 'rgba(96, 165, 250, 0.55)',
                      } : undefined}
                    >
                      <VStack className="flex-1 gap-2">
                        <HStack className="items-center justify-between gap-3">
                          <Text className="text-zinc-100 font-medium flex-1" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
                            {participant.name}
                          </Text>
                          <HStack className="items-center justify-end gap-2 shrink-0">
                            {participant.id === organizerId && (
                              <View
                                className="px-2 py-1 rounded-full border"
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.16)',
                                  borderColor: 'rgba(52, 211, 153, 0.5)',
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: '#a7f3d0' }}
                                >
                                  Creator
                                </Text>
                              </View>
                            )}
                            {participant.isCurrentUser && (
                              <View
                                className="px-2 py-1 rounded-full border"
                                style={{
                                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                                  borderColor: 'rgba(96, 165, 250, 0.5)',
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: '#bfdbfe' }}
                                >
                                  You
                                </Text>
                              </View>
                            )}
                            {participant.duplicateIndex && (
                              <View
                                className="w-7 h-7 rounded-full border items-center justify-center"
                                style={{
                                  backgroundColor: participant.accent.bgColor,
                                  borderColor: participant.accent.borderColor,
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold uppercase tracking-wider text-center"
                                  style={{ color: participant.accent.textColor }}
                                >
                                  {participant.duplicateIndex}
                                </Text>
                              </View>
                            )}
                          </HStack>
                        </HStack>
                        {participantRoles.length > 0 && (
                          <HStack className="flex-wrap gap-2">
                            {visibleRoles.map((roleName) => (
                              <View
                                key={`${participant.id}-${roleName}`}
                                className="px-2 py-1 rounded-full border"
                                style={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.16)',
                                  borderColor: 'rgba(251, 191, 36, 0.45)',
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: '#fde68a' }}
                                  {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}
                                >
                                  {roleName}
                                </Text>
                              </View>
                            ))}
                            {overflowCount > 0 && (
                              <View
                                className="px-2 py-1 rounded-full border"
                                style={{
                                  backgroundColor: 'rgba(63, 63, 70, 0.45)',
                                  borderColor: 'rgba(113, 113, 122, 0.65)',
                                }}
                              >
                                <Text
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                  style={{ color: '#e4e4e7' }}
                                >
                                  +{overflowCount}
                                </Text>
                              </View>
                            )}
                          </HStack>
                        )}
                      </VStack>
                    </HStack>
                  );
                })}
              </VStack>
            </ScrollView>
          ) : sortedRoles.length === 0 ? (
            <Text className="text-zinc-400 text-center py-4 mb-4">No roles have been claimed yet.</Text>
          ) : (
            <ScrollView 
              className="w-full mb-4 shrink" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <VStack className="gap-2">
                {sortedRoles.map(([roleName, holderIds]) => (
                  <VStack
                    key={roleName}
                    className="bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-700/50 gap-2"
                  >
                    <View
                      className="self-start px-2 py-1 rounded-full border"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.16)',
                        borderColor: 'rgba(251, 191, 36, 0.45)',
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: '#fde68a' }}
                      >
                        {roleName}
                      </Text>
                    </View>
                    <VStack className="gap-1">
                      {holderIds
                        .map((holderId) => participantNamesById[holderId] || 'Unknown User')
                        .sort((a, b) => a.localeCompare(b))
                        .map((name) => (
                          <Text key={`${roleName}-${name}`} className="text-zinc-100 text-sm">
                            {name}
                          </Text>
                        ))}
                    </VStack>
                  </VStack>
                ))}
              </VStack>
            </ScrollView>
          )}

          <Button size="lg" variant="outline" className="border-zinc-700 w-full bg-zinc-800 mt-2 shrink-0" onPress={onClose}>
            <ButtonText className="text-zinc-300 font-bold">Close</ButtonText>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
