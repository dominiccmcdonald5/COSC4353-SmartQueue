import React, { useEffect, useRef, useState } from 'react';
import { MdClose } from 'react-icons/md';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

export const NotificationBanner: React.FC = () => {
  const { isNextInLine, canProceedToPurchase, proceedConcertName } = useNotification();
  const [dismissed, setDismissed] = useState(false);
  const prevNl = useRef<boolean | null>(null);
  const prevCp = useRef<boolean | null>(null);

  useEffect(() => {
    if (
      prevNl.current !== null &&
      (prevNl.current !== isNextInLine || prevCp.current !== canProceedToPurchase)
    ) {
      setDismissed(false);
    }
    prevNl.current = isNextInLine;
    prevCp.current = canProceedToPurchase;
  }, [isNextInLine, canProceedToPurchase]);

  const active = isNextInLine || canProceedToPurchase;
  const show = active && !dismissed;

  if (!show) {
    return null;
  }

  return (
    <div className="position-6-notification">
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
          onClick={() => setDismissed(true)}
        >
          <MdClose size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
};
