import { useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useFocusEffect } from 'expo-router';

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

            const eventPromises = joinedEvents.map(async (eventId: string) => {
              const eventDoc = await getDoc(doc(db, 'events', eventId));
              if (eventDoc.exists()) {
                return { id: eventId, ...eventDoc.data() } as EventData;
              }
              return null;
            });

            const eventResults = await Promise.all(eventPromises);
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

  return { events, loading, removeEvent };
};
