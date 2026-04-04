import { useState, useCallback } from 'react';
import { arrayRemove, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useFocusEffect } from 'expo-router';
import { shouldAutoEndEvent } from '@/utils/eventStatus';

export interface PollSummary {
  totalPolls: number;
  totalVotes: number;
  topPolls: { question: string; topChoice: string; topVotes: number; totalVotes: number }[];
}

export interface EventData {
  id: string;
  title: string;
  time: string,
  location: string,
  status: string;
  scheduledAt?: string | null;
  joinCode?: string;
  organizerId?: string;
  summary?: PollSummary;
}

export const useDashboard = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchEvents = async () => {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));

          if (userDoc.exists()) {
            const joinedEvents = userDoc.data().joinedEvents || [];
            const missingEventIds: string[] = [];

            const eventPromises = joinedEvents.map(async (eventId: string) => {
              const eventDoc = await getDoc(doc(db, 'events', eventId));
              if (eventDoc.exists()) {
                const eventData = eventDoc.data();

                if (shouldAutoEndEvent(eventData)) {
                  await updateDoc(doc(db, 'events', eventId), {
                    status: 'ended',
                    endedAt: serverTimestamp(),
                  });

                  return { id: eventId, ...eventData, status: 'ended' } as EventData;
                }

                return { id: eventId, ...eventData } as EventData;
              }

              missingEventIds.push(eventId);
              return null;
            });

            const eventResults = await Promise.all(eventPromises);

            if (missingEventIds.length > 0) {
              await updateDoc(doc(db, 'users', user.uid), {
                joinedEvents: arrayRemove(...missingEventIds),
              });
            }

            setEvents(eventResults.filter(e => e !== null) as EventData[]);
          }
        } catch (error) {
          console.error("Error fetching dashboard events:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchEvents();
    }, [])
  );

  const removeEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const updateEvent = (eventId: string, updates: Partial<EventData>) => {
    setEvents((prev) => prev.map((event) => (
      event.id === eventId ? { ...event, ...updates } : event
    )));
  };

  return { events, loading, removeEvent, updateEvent };
};
