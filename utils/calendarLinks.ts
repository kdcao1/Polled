import { Platform, Linking } from 'react-native';
import { getScheduledEventDate } from '@/utils/eventStatus';

type CalendarProvider = 'google' | 'apple';

type CalendarEventInput = {
  eventData: any;
  joinLink?: string;
};

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

const formatGoogleDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const buildDescription = (joinLink?: string) =>
  ['Created with Polled.', joinLink ? `Join event: ${joinLink}` : '']
    .filter(Boolean)
    .join('\n');

export function getCalendarEventDetails({ eventData, joinLink }: CalendarEventInput) {
  const startsAt = getScheduledEventDate(eventData);
  if (!startsAt) return null;

  const endsAt = new Date(startsAt.getTime() + DEFAULT_EVENT_DURATION_MS);
  const title = eventData?.title?.trim() || 'Polled event';
  const location = eventData?.location?.trim() || '';
  const description = buildDescription(joinLink);

  return {
    title,
    location,
    description,
    startsAt,
    endsAt,
  };
}

export function buildGoogleCalendarUrl(input: CalendarEventInput) {
  const event = getCalendarEventDetails(input);
  if (!event) return null;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startsAt)}/${formatGoogleDate(event.endsAt)}`,
    details: event.description,
  });

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildAppleCalendarUrl(input: CalendarEventInput) {
  const event = getCalendarEventDetails(input);
  if (!event) return null;

  const uid = `polled-${event.startsAt.getTime()}@polled.app`;
  const now = formatGoogleDate(new Date());
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Polled//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatGoogleDate(event.startsAt)}`,
    `DTEND:${formatGoogleDate(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export async function openCalendarEvent(provider: CalendarProvider, input: CalendarEventInput) {
  const url =
    provider === 'google'
      ? buildGoogleCalendarUrl(input)
      : buildAppleCalendarUrl(input);

  if (!url) return false;

  if (Platform.OS === 'web' && provider === 'apple' && typeof window !== 'undefined') {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'polled-event.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  await Linking.openURL(url);
  return true;
}
