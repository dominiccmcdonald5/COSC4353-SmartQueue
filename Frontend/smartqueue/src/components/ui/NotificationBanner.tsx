import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

function bannerNeverKey(userId: string, concertId: number) {
  return `sq_banner_never_${userId}_${concertId}`;
}

export const NotificationBanner: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    isNextInLine,
    canProceedToPurchase,
    proceedConcertName,
    queueBannerConcertId,
  } = useNotification();

  const [neverTick, setNeverTick] = useState(0);
  const [softDismissed, setSoftDismissed] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const prevCidRef = useRef<number | null>(null);

  const active = isNextInLine || canProceedToPurchase;
  const cid = queueBannerConcertId ?? 0;

  const neverKey =
    user?.id && active && cid > 0 ? bannerNeverKey(user.id, cid) : '';

  const neverSuppressed = useMemo(() => {
    if (!neverKey || typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(neverKey) === '1';
  }, [neverKey, neverTick]);

  const baseEligible = Boolean(user?.id) && active && cid > 0 && !neverSuppressed;

  /** New route or different concert → banner may show again (unless “don’t remind”). */
  useEffect(() => {
    setSoftDismissed(false);
    setIsFadingOut(false);
  }, [location.pathname, neverKey]);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const prev = prevCidRef.current;
    if (prev != null && prev > 0 && queueBannerConcertId === null) {
      sessionStorage.removeItem(bannerNeverKey(uid, prev));
    }
    prevCidRef.current = queueBannerConcertId;
  }, [queueBannerConcertId, user?.id]);

  useEffect(() => {
    if (!baseEligible || softDismissed || isFadingOut) return undefined;
    const t = window.setTimeout(() => setIsFadingOut(true), 10_000);
    return () => window.clearTimeout(t);
  }, [baseEligible, softDismissed, isFadingOut, location.pathname, neverKey]);

  const dismissSoft = useCallback(() => {
    setSoftDismissed(true);
    setIsFadingOut(false);
  }, []);

  const dismissNever = useCallback(() => {
    if (!neverKey) return;
    sessionStorage.setItem(neverKey, '1');
    setNeverTick((n) => n + 1);
    setIsFadingOut(false);
    setSoftDismissed(false);
  }, [neverKey]);

  const onFadeTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'opacity') return;
      if (!isFadingOut) return;
      dismissSoft();
    },
    [isFadingOut, dismissSoft]
  );

  const renderBanner = baseEligible && (!softDismissed || isFadingOut);
  if (!renderBanner) {
    return null;
  }

  return (
    <div
      className={`position-6-notification${isFadingOut ? ' is-fading-out' : ''}`}
      onTransitionEnd={onFadeTransitionEnd}
    >
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
          {cid > 0 ? (
            <Link className="notification-go-queue-btn" to={`/queue/${cid}`}>
              Go to queue →
            </Link>
          ) : null}
        </div>
        <div className="notification-actions">
          <button
            type="button"
            className="notification-dismiss-never"
            onClick={dismissNever}
          >
            Don&apos;t remind me again
          </button>
          <button
            type="button"
            className="notification-close"
            aria-label="Dismiss notification"
            onClick={dismissSoft}
          >
            <span className="notification-close-x" aria-hidden>
              ×
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
