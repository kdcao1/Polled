import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export interface EventData {
  id: string;
  title: string;
  status: string;
}

export const useDashboard = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  // useFocusEffect ensures it re-fetches every time they navigate back to the dashboard
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
          // 1. Get the user's saved list of invite codes
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const joinedEvents = userDoc.data().joinedEvents || [];

            // 2. Fetch the actual title and status for each of those codes
            const eventPromises = joinedEvents.map(async (eventId: string) => {
              const eventDoc = await getDoc(doc(db, 'events', eventId));
              if (eventDoc.exists()) {
                return { id: eventId, ...eventDoc.data() } as EventData;
              }
              return null;
            });

            const eventResults = await Promise.all(eventPromises);
            
            // 3. Filter out any dead links and save to state
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

  return { events, loading };
};