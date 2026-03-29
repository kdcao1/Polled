import React from 'react';
import { Platform } from 'react-native';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { EventData } from '../../hooks/useDashboard';

export default function EventSummaryBadge({ event }: { event: EventData }) {
  const { summary } = event;
  
  if (!summary || summary.totalPolls === 0) return null;

  const top = summary.topPolls?.[0];
  const pct =
    top && top.totalVotes > 0
      ? Math.round((top.topVotes / top.totalVotes) * 100)
      : 0;

  return (
    <VStack className="mt-3 pt-3 border-t border-zinc-700 gap-1">
      <Text className="text-zinc-500 text-xs">
        {summary.totalPolls} poll{summary.totalPolls !== 1 ? 's' : ''} · {summary.totalVotes} vote{summary.totalVotes !== 1 ? 's' : ''}
      </Text>
      {top && (
        <Text className="text-zinc-400 text-xs" {...(Platform.OS !== 'web' ? { numberOfLines: 1 } : {})}>
          "{top.question}" → {top.topChoice} ({pct}%)
        </Text>
      )}
    </VStack>
  );
}