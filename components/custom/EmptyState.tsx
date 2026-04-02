import React from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

type Props = {
  message: string;
};

export default function EmptyState({ message }: Props) {
  return (
    <Box className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 items-center border-dashed">
      <Text className="text-zinc-500">{message}</Text>
    </Box>
  );
}
