export type EventItemType = 'poll' | 'role';
export type PollEndCondition = 'time' | 'vote_count';

export function getEventItemType(item: any): EventItemType {
  return item?.type === 'role' ? 'role' : 'poll';
}

export function getRespondedUserIds(item: any): string[] {
  if (!Array.isArray(item?.options)) return [];

  const uniqueIds = new Set<string>();

  item.options.forEach((option: any) => {
    if (!Array.isArray(option?.voterIds)) return;
    option.voterIds.forEach((uid: string) => uniqueIds.add(uid));
  });

  return Array.from(uniqueIds);
}

export function getResponseCount(item: any): number {
  return getRespondedUserIds(item).length;
}

export function isRoleItemFull(item: any): boolean {
  if (getEventItemType(item) !== 'role') return false;
  if (item?.slotLimit == null) return false;
  return getResponseCount(item) >= item.slotLimit;
}

export function isEventItemExpired(item: any): boolean {
  if (!item) return false;

  if (getEventItemType(item) === 'role') {
    return isRoleItemFull(item);
  }

  if (item.endCondition === 'vote_count' && item.targetVoteCount) {
    return getResponseCount(item) >= item.targetVoteCount;
  }

  if (!item.expiresAt) return false;
  const expiresAtDate = item.expiresAt?.toDate ? item.expiresAt.toDate() : new Date(item.expiresAt);
  return new Date() > expiresAtDate;
}
