import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

/** Separate keys so “6th in line” and “top 5” each show once per queue visit; cleared when concert queue context clears. */
function bannerSessionKey(userId: string, concertId: number, mode: 'next' | 'proceed') {
  return `sq_banner_${userId}_${concertId}_${mode}`;
}

export const NotificationBanner: React.FC = () => {
  const { user } = useAuth();
  const {
    isNextInLine,
    canProceedToPurchase,
    proceedConcertName,
    queueBannerConcertId,
  } = useNotification();

  const [suppressTick, setSuppressTick] = useState(0);
  const prevCidRef = useRef<number | null>(null);

  const active = isNextInLine || canProceedToPurchase;
  const mode: 'next' | 'proceed' = canProceedToPurchase ? 'proceed' : 'next';
  const cid = queueBannerConcertId ?? 0;

  const suppressKey =
    user?.id && active && cid > 0 ? bannerSessionKey(user.id, cid, mode) : '';

  const suppressed = useMemo(() => {
    if (!suppressKey || typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(suppressKey) === '1';
  }, [suppressKey, suppressTick]);

  const show = Boolean(user?.id) && active && !suppressed;

  const suppressNow = useCallback(() => {
    if (!suppressKey) return;
    sessionStorage.setItem(suppressKey, '1');
    setSuppressTick((n) => n + 1);
  }, [suppressKey]);

  /** Leaving queue clears concert id — reset both banner suppressions for that concert so the next join works. */
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const prev = prevCidRef.current;
    if (prev != null && prev > 0 && queueBannerConcertId === null) {
      sessionStorage.removeItem(bannerSessionKey(uid, prev, 'next'));
      sessionStorage.removeItem(bannerSessionKey(uid, prev, 'proceed'));
    }
    prevCidRef.current = queueBannerConcertId;
  }, [queueBannerConcertId, user?.id]);

  const handleAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.animationName !== 'slideUp') return;
      suppressNow();
    },
    [suppressNow]
  );

  if (!show) {
    return null;
  }

  return (
    <div className="position-6-notification" onAnimationEnd={handleAnimationEnd}>
      <div className="notification-content">
        <span className="notification-icon">🎉</span>
        <div className="notification-text">
          {canProceedToPurchase ? (
            <>
              <h2>You Can Proceed!</h2>
              <p>
                You can now purchase a ticket for {proceedConcertName || 'this concert'}. Grab it while it lasts.
              </p>
            </>
          ) : (
            <>
              <h2>You're Almost There!</h2>
              <p>You are 6th in line. Prepare your payment method to quickly get your tickets!</p>
            </>
          )}
        </div>
        <button
          type="button"
          className="notification-close"
          aria-label="Dismiss notification"
          onClick={suppressNow}
        >
          <span className="notification-close-x" aria-hidden>
            ×
          </span>
        </button>
      </div>
    </div>
  );
};
