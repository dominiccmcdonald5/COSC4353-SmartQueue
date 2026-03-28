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

    // Check queue status to detect if user is next in line
    const checkQueueStatus = async () => {
      try {
        // Check all concerts to see if user is next in line (position 6) in any queue
        for (let concertId = 1; concertId <= 180; concertId++) {
          try {
            const response = await fetch(
              `http://localhost:5000/api/queue/${concertId}?userId=${encodeURIComponent(user.id)}`
            );
            const payload = (await response.json()) as {
              success: boolean;
              data?: { isNextInLine: boolean };
            };

            if (payload.success && payload.data?.isNextInLine === true) {
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
