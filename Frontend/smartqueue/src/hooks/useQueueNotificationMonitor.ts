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

    const getConcertIds = async (): Promise<number[]> => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/concerts`);
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

    const checkQueueStatus = async () => {
      try {
        const concertIds = await getConcertIds();
        for (const concertId of concertIds) {
          try {
            const response = await fetch(
              `${API_BASE}/api/queue/${concertId}?userId=${encodeURIComponent(user.id)}`
            );
            const payload = (await response.json()) as {
              success: boolean;
              data?: {
                isNextInLine: boolean;
                isInQueue: boolean;
                canProceedToSeatSelection?: boolean;
                concertName?: string;
              };
            };

            if (payload.success && payload.data?.isInQueue && payload.data?.canProceedToSeatSelection === true) {
              setQueueBannerConcertId(concertId);
              setCanProceedToPurchase(true);
              setProceedConcertName(payload.data?.concertName ?? null);
              setIsNextInLine(false);
              return;
            }

            if (payload.success && payload.data?.isInQueue && payload.data?.isNextInLine === true) {
              setQueueBannerConcertId(concertId);
              setIsNextInLine(true);
              setCanProceedToPurchase(false);
              setProceedConcertName(null);
              return;
            }
          } catch {
            continue;
          }
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
