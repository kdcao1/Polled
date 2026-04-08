import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import EmptyState from '@/components/custom/EmptyState';
import { clearLocalAnalyticsEvents, getLocalAnalyticsEvents } from '@/utils/analytics';

type AnalyticsRecord = Awaited<ReturnType<typeof getLocalAnalyticsEvents>>[number];

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatParams = (params: Record<string, string | number>) => {
  const entries = Object.entries(params);
  if (!entries.length) return 'No params';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
};

export default function DebugScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<AnalyticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadRecords = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextRecords = await getLocalAnalyticsEvents();
      setRecords([...nextRecords].reverse());
    } catch (error) {
      console.error('Error loading local analytics:', error);
    } finally {
      if (mode === 'refresh') {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const sentCount = records.filter((record) => record.delivery === 'sent').length;
  const localOnlyCount = records.filter((record) => record.delivery === 'local_only').length;
  const failedCount = records.filter((record) => record.delivery === 'failed').length;
  const sentRecords = records.filter((record) => record.delivery === 'sent');
  const nonSentRecords = records.filter((record) => record.delivery !== 'sent');
  const sentEventCounts = Object.entries(
    sentRecords.reduce<Record<string, number>>((acc, record) => {
      acc[record.name] = (acc[record.name] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);
  const maxSentEventCount = sentEventCounts[0]?.[1] || 1;

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearLocalAnalyticsEvents();
      setRecords([]);
    } catch (error) {
      console.error('Error clearing local analytics:', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Box className="flex-1 bg-zinc-900 px-6 pt-4">
      <VStack className="gap-6 w-full max-w-3xl self-center flex-1">
        <VStack className="gap-2">
          <Button
            variant="link"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/dashboard');
            }}
            className="self-start p-0 -ml-2"
          >
            <ButtonText className="text-blue-500">&lt; Back</ButtonText>
          </Button>
          <Heading size="2xl" className="text-zinc-50">Debug Analytics</Heading>
          <Text className="text-zinc-400">
            Local backup of analytics events captured by the app.
          </Text>
        </VStack>

        <HStack className="gap-3 flex-wrap">
          <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 min-w-[120px]">
            <Text className="text-zinc-400 text-xs uppercase font-bold tracking-wider">Total</Text>
            <Text className="text-zinc-50 text-xl font-bold mt-1">{records.length}</Text>
          </Box>
          <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 min-w-[120px]">
            <Text className="text-zinc-400 text-xs uppercase font-bold tracking-wider">Sent</Text>
            <Text className="text-emerald-400 text-xl font-bold mt-1">{sentCount}</Text>
          </Box>
          <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 min-w-[120px]">
            <Text className="text-zinc-400 text-xs uppercase font-bold tracking-wider">Local Only</Text>
            <Text className="text-blue-400 text-xl font-bold mt-1">{localOnlyCount}</Text>
          </Box>
          <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 min-w-[120px]">
            <Text className="text-zinc-400 text-xs uppercase font-bold tracking-wider">Failed</Text>
            <Text className="text-red-400 text-xl font-bold mt-1">{failedCount}</Text>
          </Box>
        </HStack>

        <HStack className="gap-3">
          <Button size="md" variant="outline" className="border-zinc-700 bg-zinc-800" onPress={() => void loadRecords('refresh')} isDisabled={refreshing || loading}>
            <ButtonText className="text-zinc-200 font-bold">Refresh</ButtonText>
          </Button>
          <Button size="md" variant="outline" className="border-red-500/30 bg-zinc-800" onPress={handleClear} isDisabled={clearing || records.length === 0}>
            {clearing ? <ButtonSpinner color="#ef4444" /> : <ButtonText className="text-red-400 font-bold">Clear Log</ButtonText>}
          </Button>
        </HStack>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : records.length === 0 ? (
          <EmptyState message="No local analytics records yet." />
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadRecords('refresh')} tintColor="#3b82f6" />}
            showsVerticalScrollIndicator={false}
          >
            <VStack className="gap-3 pb-10">
              <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4">
                <VStack className="gap-4">
                  <VStack className="gap-1">
                    <Text className="text-zinc-50 font-semibold">Sent Event Counts</Text>
                    <Text className="text-zinc-500 text-xs">
                      Grouped view of analytics that were successfully sent.
                    </Text>
                  </VStack>

                  {sentEventCounts.length === 0 ? (
                    <Text className="text-zinc-400 text-sm">No sent events yet.</Text>
                  ) : (
                    <VStack className="gap-3">
                      {sentEventCounts.map(([eventName, count]) => (
                        <VStack key={eventName} className="gap-1.5">
                          <HStack className="justify-between items-center gap-3">
                            <Text className="text-zinc-200 text-sm font-medium flex-1" numberOfLines={1}>
                              {eventName}
                            </Text>
                            <Text className="text-emerald-300 text-sm font-bold">{count}</Text>
                          </HStack>
                          <View className="h-2 rounded-full bg-zinc-900/80 overflow-hidden">
                            <View
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${Math.max((count / maxSentEventCount) * 100, 6)}%` }}
                            />
                          </View>
                        </VStack>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Box>

              <Box className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4">
                <VStack className="gap-4">
                  <VStack className="gap-1">
                    <Text className="text-zinc-50 font-semibold">Unsent / Problem Records</Text>
                    <Text className="text-zinc-500 text-xs">
                      Detailed log for events that stayed local or failed to send.
                    </Text>
                  </VStack>

                  {nonSentRecords.length === 0 ? (
                    <Text className="text-zinc-400 text-sm">No unsent analytics records.</Text>
                  ) : (
                    <VStack className="gap-3">
                      {nonSentRecords.map((record) => (
                        <Box key={record.id} className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4">
                          <HStack className="justify-between items-start gap-3">
                            <VStack className="flex-1 gap-1">
                              <Text className="text-zinc-50 font-semibold">{record.name}</Text>
                              <Text className="text-zinc-500 text-xs">
                                {record.kind} • {record.platform} • {formatTimestamp(record.createdAt)}
                              </Text>
                            </VStack>
                            <View
                              className="px-2 py-1 rounded-full border"
                              style={{
                                backgroundColor:
                                  record.delivery === 'failed'
                                    ? 'rgba(239, 68, 68, 0.16)'
                                    : 'rgba(37, 99, 235, 0.16)',
                                borderColor:
                                  record.delivery === 'failed'
                                    ? 'rgba(248, 113, 113, 0.45)'
                                    : 'rgba(96, 165, 250, 0.45)',
                              }}
                            >
                              <Text
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  color:
                                    record.delivery === 'failed'
                                      ? '#fca5a5'
                                      : '#bfdbfe',
                                }}
                              >
                                {record.delivery}
                              </Text>
                            </View>
                          </HStack>

                          <Text className="text-zinc-300 text-sm mt-3">
                            {formatParams(record.params)}
                          </Text>

                          {record.failureReason ? (
                            <Text className="text-red-400 text-xs mt-2">
                              {record.failureReason}
                            </Text>
                          ) : null}
                        </Box>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Box>
            </VStack>
          </ScrollView>
        )}
      </VStack>
    </Box>
  );
}
