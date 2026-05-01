import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

export const NotificationBanner: React.FC = () => {
  const { isNextInLine, canProceedToPurchase, proceedConcertName } = useNotification();

  if (!isNextInLine && !canProceedToPurchase) {
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
      </div>
    </div>
  );
};
