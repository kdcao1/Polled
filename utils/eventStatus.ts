export type EventStatus = 'voting' | 'ended';

export function parseScheduledEventDate(value?: string | null): Date | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  const parsedMs = Date.parse(trimmedValue);
  if (Number.isNaN(parsedMs)) return null;

  return new Date(parsedMs);
}

export function getScheduledEventDate(event: any): Date | null {
  if (event?.scheduledAt) {
    const scheduledDate = new Date(event.scheduledAt);
    if (!Number.isNaN(scheduledDate.getTime())) {
      return scheduledDate;
    }
  }

  return parseScheduledEventDate(event?.time);
}

export function isEventEnded(event: any): boolean {
  return !!event?.status && event.status !== 'voting';
}

export function shouldAutoEndEvent(event: any, now = new Date()): boolean {
  if (!event || isEventEnded(event)) return false;

  const scheduledDate = getScheduledEventDate(event);
  if (!scheduledDate) return false;

  return scheduledDate.getTime() <= now.getTime();
}

export function getEventStatusLabel(event: any): string {
  return event?.status === 'voting' ? 'Active' : 'Ended';
}
