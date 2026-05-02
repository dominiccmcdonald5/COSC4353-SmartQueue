import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

function clearQueueBannerSessionForUser(userId: string) {
  const prefix = `sq_qb_${userId}_`;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) {
      sessionStorage.removeItem(k);
    }
  }
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

  const active = isNextInLine || canProceedToPurchase;
  const mode = canProceedToPurchase ? 'proceed' : 'next';
  const cid = queueBannerConcertId ?? 0;
  const suppressKey =
    user?.id && active ? `sq_qb_${user.id}_${cid}_${mode}` : '';

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

  useEffect(() => {
    if (!active && user?.id) {
      clearQueueBannerSessionForUser(user.id);
    }
  }, [active, user?.id]);

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
