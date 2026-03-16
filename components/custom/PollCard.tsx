import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';

interface PollCardProps {
  poll: any;
  compact?: boolean;
  deletable?: boolean;
  showResults?: boolean;
  currentUid?: string;
  onVote: (pollId: string, optionIndex: number, currentOptions: any[], allowMultipleVotes: boolean) => void;
  onDelete: (pollId: string) => void;
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

export default function PollCard({ poll, compact = false, deletable = false, showResults = false, currentUid, onVote, onDelete }: PollCardProps) {
  const totalVotes = poll.options.reduce((s: number, o: any) => s + o.voterIds.length, 0);
  const expiresAtDate = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : (poll.expiresAt ? new Date(poll.expiresAt) : null);
  
  const [isExpired, setIsExpired] = useState(() => expiresAtDate ? new Date() > expiresAtDate : false);
  const [timeLeft, setTimeLeft] = useState(() => expiresAtDate && !isExpired ? formatTimeLeft(expiresAtDate) : '');

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
  }, [expiresAtDate, isExpired]);

  const displayResults = showResults || isExpired;

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
          {deletable && (
            <TouchableOpacity
              onPress={() => onDelete(poll.id)}
              className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-1 active:bg-red-900/60 justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-red-400 text-xs font-semibold leading-none">Delete</Text>
            </TouchableOpacity>
          )}
        </HStack>
      </HStack>

      <VStack className={compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}>
        {poll.options.map((option: any, index: number) => {
          const hasVoted = option.voterIds.includes(currentUid);
          const voteCount = option.voterIds.length;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={isExpired ? 1 : 0.7}
              disabled={isExpired}
              onPress={() => onVote(poll.id, index, poll.options, poll.allowMultiple)}
              className={`rounded-lg border overflow-hidden relative ${compact ? 'p-3' : 'p-4'} ${hasVoted ? 'bg-blue-900/40 border-blue-500' : 'bg-zinc-900/50 border-zinc-700'}`}
            >
              {displayResults && (
                <View className={`absolute top-0 bottom-0 left-0 ${hasVoted ? 'bg-blue-600/30' : 'bg-zinc-700/50'}`} style={{ width: `${pct}%` }} />
              )}
              <HStack className="justify-between items-center z-10">
                <Text className={`font-medium ${compact ? 'text-sm' : ''} ${hasVoted ? 'text-blue-100' : 'text-zinc-300'}`}>
                  {option.text}
                </Text>
                <Text className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${hasVoted ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {displayResults ? `${pct}% (${voteCount})` : `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`}
                </Text>
              </HStack>
            </TouchableOpacity>
          );
        })}
      </VStack>
    </VStack>
  );
}