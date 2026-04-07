import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { getEventItemType, getResponseCount, isEventItemExpired, isRoleItemFull } from '@/utils/eventItems';

interface PollCardProps {
  poll: any;
  compact?: boolean;
  isOrganizer?: boolean;
  showResults?: boolean;
  currentUid?: string;
  onVote: (pollId: string, optionIndex: number | number[], currentOptions: any[], allowMultipleVotes: boolean) => void;
  onAddChoice?: (pollId: string, choiceText: string) => Promise<boolean>;
  onActionPress?: (poll: any) => void;
}

const formatTimeLeft = (expirationDate: Date) => {
  const diffMs = expirationDate.getTime() - new Date().getTime();
  if (diffMs <= 0) return 'Ended';
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(diffMins / (60 * 24));
  const hours = Math.floor((diffMins % (60 * 24)) / 60);
  const minutes = diffMins % 60;

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Ends in ${minutes}m`;
  return 'Ends in < 1m';
};

export default function PollCard({ poll, compact = false, isOrganizer = false, showResults = false, currentUid, onVote, onAddChoice, onActionPress }: PollCardProps) {
  const itemType = getEventItemType(poll);
  const isRole = itemType === 'role';
  const options = Array.isArray(poll?.options) ? poll.options : [];
  const totalVotes = getResponseCount(poll);
  const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);

  const [isExpired, setIsExpired] = useState(() => isEventItemExpired(poll));
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!expiresAtDate || isExpired || poll.endCondition === 'vote_count') return '';
    return formatTimeLeft(expiresAtDate);
  });

  const expiresAtMs = expiresAtDate?.getTime();

  useEffect(() => {
    setIsExpired(isEventItemExpired(poll));
    if (expiresAtDate && !isEventItemExpired(poll) && poll.endCondition !== 'vote_count') {
      setTimeLeft(formatTimeLeft(expiresAtDate));
    }
  }, [poll, expiresAtMs]);

  const [isEditingMultiple, setIsEditingMultiple] = useState(false);
  const [localSelections, setLocalSelections] = useState<number[]>([]);
  const [isAddingChoice, setIsAddingChoice] = useState(false);
  const [newChoiceText, setNewChoiceText] = useState('');
  const [isSubmittingChoice, setIsSubmittingChoice] = useState(false);

  useEffect(() => {
    if (!isEditingMultiple && currentUid && !isRole) {
      setLocalSelections(
        options
          .map((o: any, i: number) => (o.voterIds.includes(currentUid) ? i : -1))
          .filter((i: number) => i !== -1)
      );
    }
  }, [options, currentUid, isEditingMultiple, isRole]);

  useEffect(() => {
    if (!expiresAtDate || isExpired || poll.endCondition === 'vote_count' || isRole) return;
    const interval = setInterval(() => {
      if (new Date() > expiresAtDate) {
        setIsExpired(true);
        clearInterval(interval);
      } else {
        setTimeLeft(formatTimeLeft(expiresAtDate));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [expiresAtMs, isExpired, poll.endCondition, isRole]);

  useEffect(() => {
    if (isExpired) {
      setIsAddingChoice(false);
      setNewChoiceText('');
      setIsSubmittingChoice(false);
    }
  }, [isExpired]);

  const displayResults = showResults || isExpired;
  const pulseAnim = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (!isRole && isExpired && totalVotes > 0) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isExpired, totalVotes, pulseAnim, isRole]);

  const roleSelection = options[0];
  const roleCount = roleSelection?.voterIds?.length ?? 0;
  const roleIsSelected = !!currentUid && !!roleSelection?.voterIds?.includes(currentUid);
  const roleIsFull = isRoleItemFull(poll);
  const roleRemaining = poll.slotLimit != null ? Math.max(poll.slotLimit - roleCount, 0) : null;

  const maxVotes = !isRole ? Math.max(0, ...options.map((o: any) => o.voterIds.length)) : 0;
  const winners = !isRole ? options.filter((o: any) => o.voterIds.length === maxVotes && maxVotes > 0) : [];
  const canInviteesAddChoices = !isRole && !!poll.allowInviteeChoices && !isOrganizer && !displayResults && !isExpired && !!onAddChoice;

  const renderTag = (label: string, colors: { backgroundColor: string; borderColor: string; textColor: string }) => (
    <Box
      className="px-2 py-1 rounded border justify-center"
      style={{
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
      }}
    >
      <Text
        className="text-xs font-bold uppercase tracking-wider leading-none"
        style={{ color: colors.textColor }}
      >
        {label}
      </Text>
    </Box>
  );

  const renderStatusBadge = () => {
    if (isRole) {
      if (roleIsFull) {
        return renderTag('Filled', {
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          borderColor: 'rgba(52, 211, 153, 0.5)',
          textColor: '#a7f3d0',
        });
      }

      if (poll.slotLimit == null) {
        return renderTag('Open', {
          backgroundColor: 'rgba(14, 165, 233, 0.16)',
          borderColor: 'rgba(56, 189, 248, 0.45)',
          textColor: '#bae6fd',
        });
      }

      return renderTag(`${roleRemaining} left`, {
        backgroundColor: 'rgba(30, 64, 175, 0.28)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        textColor: '#93c5fd',
      });
    }

    if (isExpired) {
      return renderTag('Ended', {
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        borderColor: 'rgba(248, 113, 113, 0.5)',
        textColor: '#fca5a5',
      });
    }

    if (poll.endCondition === 'vote_count' && poll.targetVoteCount) {
      return renderTag(`${totalVotes} / ${poll.targetVoteCount} votes`, {
        backgroundColor: 'rgba(30, 64, 175, 0.28)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        textColor: '#60a5fa',
      });
    }

    if (expiresAtDate) {
      return renderTag(timeLeft, {
        backgroundColor: 'rgba(30, 64, 175, 0.28)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        textColor: '#60a5fa',
      });
    }

    return null;
  };

  const renderRoleBody = () => {
    const roleActionLabel = roleIsSelected ? 'Leave Role' : roleIsFull ? 'Filled' : 'Take Role';

    return (
      <VStack className={compact ? 'gap-3 mt-1' : 'gap-3 mt-2'}>
        <View className={`rounded-lg border border-zinc-700 bg-zinc-900/50 ${compact ? 'p-3' : 'p-4'}`}>
          <HStack className="justify-between items-center gap-3">
            <VStack className="flex-1 gap-1">
              <Text className={`text-zinc-100 font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
                {poll.slotLimit == null ? 'Unlimited spots' : `${roleCount} of ${poll.slotLimit} taken`}
              </Text>
              <Text className={`text-zinc-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                {roleIsSelected
                  ? 'You are signed up for this role.'
                  : roleIsFull
                    ? 'All spots have been claimed.'
                    : 'Claim this role if you want to take it on.'}
              </Text>
            </VStack>
            <Button
              size={compact ? 'sm' : 'md'}
              action={roleIsSelected ? 'secondary' : 'primary'}
              variant={roleIsSelected ? 'outline' : 'solid'}
              className={roleIsSelected ? 'border-zinc-600 bg-zinc-800' : 'bg-blue-600 border-0'}
              isDisabled={roleIsFull && !roleIsSelected}
              onPress={() => onVote(poll.id, 0, options, false)}
            >
              <ButtonText className={roleIsSelected ? 'text-zinc-100 font-bold' : 'text-white font-bold'}>
                {roleActionLabel}
              </ButtonText>
            </Button>
          </HStack>
        </View>
      </VStack>
    );
  };

  return (
    <VStack className={`bg-zinc-800 rounded-xl border ${isExpired ? 'border-zinc-700/50 opacity-80' : 'border-zinc-700'} gap-2 ${compact ? 'p-4' : 'p-5 gap-4'}`}>
      <HStack className="justify-between items-start">
        <VStack className={`flex-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
          <HStack className="items-center gap-2 mb-1 flex-wrap">
            <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>
              {poll.question}
            </Text>
            {isRole && (
              <Box
                className="px-2 py-1 rounded-full border justify-center"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.16)',
                  borderColor: 'rgba(251, 191, 36, 0.45)',
                }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider leading-none"
                  style={{ color: '#fde68a' }}
                >
                  Role
                </Text>
              </Box>
            )}
            {!isRole && poll.linkedField && (
              <Box
                className="px-2 py-1 rounded-full border justify-center"
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.18)',
                  borderColor: 'rgba(96, 165, 250, 0.45)',
                }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider leading-none"
                  style={{ color: '#93c5fd' }}
                >
                  {poll.linkedField === 'time' ? 'Time' : 'Location'}
                </Text>
              </Box>
            )}
          </HStack>
          {!isRole && poll.allowMultiple && !isExpired && (
            <Text className={`text-blue-400 font-semibold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
              Select Multiple
            </Text>
          )}
        </VStack>

        <HStack className="items-center gap-3 shrink-0">
          {renderStatusBadge()}
          {isOrganizer && onActionPress && (
            <TouchableOpacity
              onPress={() => onActionPress(poll)}
              className="w-8 h-8 rounded-full bg-zinc-900/50 items-center justify-center border border-zinc-700/50 shrink-0 active:bg-zinc-700/50"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MoreVertical size={16} color="#a1a1aa" />
            </TouchableOpacity>
          )}
        </HStack>
      </HStack>

      {isRole ? renderRoleBody() : (
        <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
          {isExpired && totalVotes === 0 && (
            <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider ml-1 mb-0.5">
              No Votes Cast
            </Text>
          )}
          {isExpired && totalVotes > 0 ? (
            <View className={`relative overflow-hidden bg-zinc-900/80 border border-yellow-600/30 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
              <Animated.View
                className="absolute top-0 bottom-0 left-0 right-0 bg-yellow-500/30"
                style={{ opacity: pulseAnim }}
              />
              <HStack className="items-center justify-between gap-3 relative z-10">
                <HStack className="items-center gap-2 flex-1">
                  <Text className={`text-yellow-500 font-bold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
                    {winners.length > 1 ? 'Tie' : 'Winner'}:
                  </Text>
                  <Text className={`font-bold text-zinc-50 flex-1 ${compact ? 'text-sm' : ''}`} numberOfLines={1}>
                    {winners.map((w: any) => w.text).join(' / ')}
                  </Text>
                </HStack>
                <Text className={`font-bold text-zinc-300 shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {Math.round((maxVotes / totalVotes) * 100)}% ({maxVotes} {maxVotes === 1 ? 'vote' : 'votes'})
                </Text>
              </HStack>
            </View>
          ) : (
            options.map((option: any, index: number) => {
              const isSelected = poll.allowMultiple
                ? localSelections.includes(index)
                : option.voterIds.includes(currentUid);
              const voteCount = option.voterIds.length;
              const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={isExpired ? 1 : 0.7}
                  disabled={isExpired}
                  onPress={() => {
                    if (poll.allowMultiple) {
                      setIsEditingMultiple(true);
                      setLocalSelections((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
                    } else {
                      onVote(poll.id, index, options, poll.allowMultiple);
                    }
                  }}
                  className={`rounded-lg border overflow-hidden relative ${compact ? 'p-3' : 'p-4'} ${isSelected ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
                >
                  {displayResults && (
                    <View className={`absolute top-0 bottom-0 left-0 ${isSelected ? 'bg-blue-600/30' : 'bg-zinc-700/50'}`} style={{ width: `${pct}%` }} />
                  )}
                  <HStack className="justify-between items-center z-10">
                    <Text className={`font-medium ${compact ? 'text-sm' : ''} ${isSelected ? 'text-blue-100' : 'text-zinc-300'}`}>
                      {option.text}
                    </Text>
                    <Text className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${isSelected ? 'text-blue-400' : 'text-zinc-500'}`}>
                      {displayResults ? `${pct}% (${voteCount})` : `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`}
                    </Text>
                  </HStack>
                </TouchableOpacity>
              );
            })
          )}
        </VStack>
      )}

      {!isRole && isEditingMultiple && !isExpired && (
        <HStack className="justify-end gap-3 mt-2">
          <Button
            size="sm"
            variant="link"
            onPress={() => {
              setIsEditingMultiple(false);
              setLocalSelections(
                options
                  .map((o: any, i: number) => (o.voterIds.includes(currentUid) ? i : -1))
                  .filter((i: number) => i !== -1)
              );
            }}
          >
            <ButtonText className="text-zinc-400">Cancel</ButtonText>
          </Button>
          <Button
            size="sm"
            action="primary"
            className="bg-blue-600 border-0"
            onPress={() => {
              setIsEditingMultiple(false);
              onVote(poll.id, localSelections, options, poll.allowMultiple);
            }}
          >
            <ButtonText className="font-bold text-white">Confirm Votes</ButtonText>
          </Button>
        </HStack>
      )}

      {canInviteesAddChoices && (
        <VStack className="gap-3 mt-2">
          {isAddingChoice ? (
            <>
              <Input variant="outline" size={compact ? 'md' : 'lg'} className="border-zinc-700 bg-zinc-900/60">
                <InputField
                  value={newChoiceText}
                  onChangeText={setNewChoiceText}
                  placeholder="Suggest another option"
                  placeholderTextColor="#71717a"
                  className="text-zinc-50"
                  editable={!isSubmittingChoice}
                />
              </Input>
              <HStack className="justify-end gap-3">
                <Button
                  size="sm"
                  variant="link"
                  isDisabled={isSubmittingChoice}
                  onPress={() => {
                    setIsAddingChoice(false);
                    setNewChoiceText('');
                  }}
                >
                  <ButtonText className="text-zinc-400">Cancel</ButtonText>
                </Button>
                <Button
                  size="sm"
                  action="primary"
                  className="bg-blue-600 border-0"
                  isDisabled={isSubmittingChoice || !newChoiceText.trim()}
                  onPress={async () => {
                    if (!onAddChoice || !newChoiceText.trim()) return;
                    setIsSubmittingChoice(true);
                    const didAdd = await onAddChoice(poll.id, newChoiceText);
                    setIsSubmittingChoice(false);
                    if (didAdd) {
                      setIsAddingChoice(false);
                      setNewChoiceText('');
                    }
                  }}
                >
                  <ButtonText className="font-bold text-white">
                    {isSubmittingChoice ? 'Adding...' : 'Add Choice'}
                  </ButtonText>
                </Button>
              </HStack>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="self-start border-zinc-600 bg-zinc-900/50"
              onPress={() => setIsAddingChoice(true)}
            >
              <ButtonText className="font-bold text-zinc-100">+ Add a Choice</ButtonText>
            </Button>
          )}
        </VStack>
      )}
    </VStack>
  );
}
