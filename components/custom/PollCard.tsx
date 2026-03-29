import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';

interface PollCardProps {
  poll: any;
  compact?: boolean;
  isOrganizer?: boolean;
  showResults?: boolean;
  currentUid?: string;
  onVote: (pollId: string, optionIndex: number | number[], currentOptions: any[], allowMultipleVotes: boolean) => void;
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

export default function PollCard({ poll, compact = false, isOrganizer = false, showResults = false, currentUid, onVote, onActionPress }: PollCardProps) {
  const totalVotes = poll.options.reduce((s: number, o: any) => s + o.voterIds.length, 0);
  const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
  
  const [isExpired, setIsExpired] = useState(() => expiresAtDate ? new Date() > expiresAtDate : false);
  const [timeLeft, setTimeLeft] = useState(() => expiresAtDate && !isExpired ? formatTimeLeft(expiresAtDate) : '');

  const expiresAtMs = expiresAtDate?.getTime();

  useEffect(() => {
    if (expiresAtDate) {
      const expired = new Date() > expiresAtDate;
      setIsExpired(expired);
      if (!expired) {
        setTimeLeft(formatTimeLeft(expiresAtDate));
      }
    }
  }, [expiresAtMs]);

  const [isEditingMultiple, setIsEditingMultiple] = useState(false);
  const [localSelections, setLocalSelections] = useState<number[]>([]);

  useEffect(() => {
    if (!isEditingMultiple && poll?.options && currentUid) {
      setLocalSelections(
        poll.options
          .map((o: any, i: number) => (o.voterIds.includes(currentUid) ? i : -1))
          .filter((i: number) => i !== -1)
      );
    }
  }, [poll, currentUid, isEditingMultiple]);

  useEffect(() => {
    if (!expiresAtDate || isExpired) return;
    const interval = setInterval(() => {
      if (new Date() > expiresAtDate) {
        setIsExpired(true);
        clearInterval(interval);
      } else {
        setTimeLeft(formatTimeLeft(expiresAtDate));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [expiresAtMs, isExpired]);

  const displayResults = showResults || isExpired;

  const maxVotes = Math.max(0, ...poll.options.map((o: any) => o.voterIds.length));
  const winners = poll.options.filter((o: any) => o.voterIds.length === maxVotes && maxVotes > 0);

  const pulseAnim = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isExpired && totalVotes > 0) {
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
  }, [isExpired, totalVotes, pulseAnim]);

  return (
    <VStack className={`bg-zinc-800 rounded-xl border ${isExpired ? 'border-zinc-700/50 opacity-80' : 'border-zinc-700'} gap-2 ${compact ? 'p-4' : 'p-5 gap-4'}`}>
      <HStack className="justify-between items-start">
        <VStack className={`flex-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
          <HStack className="items-center gap-2 mb-1 flex-wrap">
            <Text className={`text-zinc-50 font-bold ${compact ? 'text-lg leading-tight' : 'text-xl'}`}>
              {poll.question}
            </Text>
          </HStack>
          {poll.allowMultiple && !isExpired && (
            <Text className={`text-blue-400 font-semibold uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>
              Select Multiple
            </Text>
          )}
        </VStack>
        
        <HStack className="items-center gap-3 shrink-0">
          {isExpired && (
            <Box className="bg-red-500/20 px-2 py-1 rounded border border-red-500 justify-center">
              <Text className="text-red-400 text-xs font-bold uppercase tracking-wider leading-none">Ended</Text>
            </Box>
          )}
          {!isExpired && expiresAtDate && (
            <Box className="bg-blue-900/30 px-2 py-1 rounded border border-blue-800/50 justify-center">
              <Text className="text-blue-400 text-xs font-bold uppercase tracking-wider leading-none">{timeLeft}</Text>
            </Box>
          )}
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
          poll.options.map((option: any, index: number) => {
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
                  setLocalSelections(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
                } else {
                  onVote(poll.id, index, poll.options, poll.allowMultiple);
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

      {isEditingMultiple && !isExpired && (
        <HStack className="justify-end gap-3 mt-2">
          <Button 
            size="sm" 
            variant="link" 
            onPress={() => {
              setIsEditingMultiple(false);
              setLocalSelections(
                poll.options
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
              onVote(poll.id, localSelections, poll.options, poll.allowMultiple);
            }}
          >
            <ButtonText className="font-bold text-white">Confirm Votes</ButtonText>
          </Button>
        </HStack>
      )}
    </VStack>
  );
}