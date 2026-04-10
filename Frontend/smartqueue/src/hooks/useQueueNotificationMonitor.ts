import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

/**
 * Global hook that monitors user's queue status across all pages
 * Displays notification when user is in queue at position 6 (next in line)
 * Syncs with API's isNextInLine flag
 */
export const useQueueNotificationMonitor = () => {
  const { user } = useAuth();
  const { isNextInLine, setIsNextInLine } = useNotification();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const getConcertIds = async (): Promise<number[]> => {
      try {
        const response = await fetch('http://localhost:5000/api/admin/concerts');
        const payload = (await response.json()) as {
          success: boolean;
          concerts?: Array<{ concert_id?: number; concertID?: number }>;
        };

        if (!response.ok || !payload.success || !Array.isArray(payload.concerts)) {
          return [];
        }

        return payload.concerts
          .map((concert) => Number(concert.concert_id ?? concert.concertID ?? 0))
          .filter((id) => Number.isInteger(id) && id > 0);
      } catch {
        return [];
      }
    };

    // Check queue status to detect if user is next in line
    const checkQueueStatus = async () => {
      try {
        const concertIds = await getConcertIds();
        for (const concertId of concertIds) {
          try {
            const response = await fetch(
              `http://localhost:5000/api/queue/${concertId}?userId=${encodeURIComponent(user.id)}`
            );
            const payload = (await response.json()) as {
              success: boolean;
              data?: { isNextInLine: boolean; isInQueue: boolean };
            };

            if (payload.success && payload.data?.isInQueue && payload.data?.isNextInLine === true) {
              // User is next in line in at least one concert
              if (!isNextInLine) {
                setIsNextInLine(true);
              }
              return; // Found a concert where user is next in line
            }
          } catch {
            // Continue to next concert if this one fails
            continue;
          }
        }

        // User is not next in line in any concert
        if (isNextInLine) {
          setIsNextInLine(false);
        }
      } catch (error) {
        console.error('Error checking queue status:', error);
      }
    };

    // Check queue status on mount and every 5 seconds
    checkQueueStatus();
    const interval = setInterval(checkQueueStatus, 5000);

    return () => clearInterval(interval);
  }, [user?.id, isNextInLine, setIsNextInLine]);
};
