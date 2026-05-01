import React, { createContext, useContext, useState, useCallback } from 'react';

interface Notification {
  id: string;
  message: string;
  title: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  isNextInLine: boolean;
  setIsNextInLine: (isNext: boolean) => void;
  canProceedToPurchase: boolean;
  setCanProceedToPurchase: (canProceed: boolean) => void;
  proceedConcertName: string | null;
  setProceedConcertName: (name: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNextInLine, setIsNextInLine] = useState(false);
  const [canProceedToPurchase, setCanProceedToPurchase] = useState(false);
  const [proceedConcertName, setProceedConcertName] = useState<string | null>(null);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { ...notification, id }]);

    if (notification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        isNextInLine,
        setIsNextInLine,
        canProceedToPurchase,
        setCanProceedToPurchase,
        proceedConcertName,
        setProceedConcertName,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
