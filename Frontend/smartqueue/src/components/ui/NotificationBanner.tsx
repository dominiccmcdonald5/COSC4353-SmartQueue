import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBanner.css';

export const NotificationBanner: React.FC = () => {
  const { isNextInLine } = useNotification();

  if (!isNextInLine) {
    return null;
  }

  return (
    <div className="position-6-notification">
      <div className="notification-content">
        <span className="notification-icon">🎉</span>
        <div className="notification-text">
          <h2>You're Almost There!</h2>
          <p>You are 6th in line. Prepare your payment method to quickly get your tickets!</p>
        </div>
      </div>
    </div>
  );
};
