import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

/**
 * Polls queue status for top-5 (banner + proceed) and 6th / next-in-line (banner).
 * Top 5 is checked first per concert; effect depends only on user id for a stable interval.
 */
export const useQueueNotificationMonitor = () => {
  const { user } = useAuth();
  const {
    setIsNextInLine,
    setCanProceedToPurchase,
    setProceedConcertName,
    setQueueBannerConcertId,
  } = useNotification();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const checkQueueStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/queue/user-status?userId=${encodeURIComponent(user.id)}`
        );
        const payload = (await response.json()) as {
          success: boolean;
          data?: {
            isInQueue: boolean;
            concertId?: number;
            concertName?: string;
            canProceedToSeatSelection?: boolean;
            isNextInLine?: boolean;
          };
        };

        if (!payload.success || !payload.data?.isInQueue) {
          setQueueBannerConcertId(null);
          setIsNextInLine(false);
          setCanProceedToPurchase(false);
          setProceedConcertName(null);
          return;
        }

        const { concertId, concertName, canProceedToSeatSelection, isNextInLine } = payload.data;

        if (canProceedToSeatSelection) {
          setQueueBannerConcertId(concertId ?? null);
          setCanProceedToPurchase(true);
          setProceedConcertName(concertName ?? null);
          setIsNextInLine(false);
          return;
        }

        if (isNextInLine) {
          setQueueBannerConcertId(concertId ?? null);
          setIsNextInLine(true);
          setCanProceedToPurchase(false);
          setProceedConcertName(null);
          return;
        }

        setQueueBannerConcertId(null);
        setIsNextInLine(false);
        setCanProceedToPurchase(false);
        setProceedConcertName(null);
      } catch (error) {
        console.error('Error checking queue status:', error);
      }
    };

    checkQueueStatus();
    const interval = setInterval(checkQueueStatus, 8000);

    return () => clearInterval(interval);
  }, [user?.id, setIsNextInLine, setCanProceedToPurchase, setProceedConcertName, setQueueBannerConcertId]);
};
