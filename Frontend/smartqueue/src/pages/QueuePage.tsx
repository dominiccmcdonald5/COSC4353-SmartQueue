import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatLocalDateFromApi } from '../utils/apiDate';
import '../components/ui/ConfirmDialog.css';
import '../styling/QueuePage.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

interface QueueStatus {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: string;
  elapsedWaitMinutes?: number;
  estimatedRemainingWaitMinutes?: number;
  concertName: string;
  artist: string;
  date: string;
  venue: string;
}

interface QueueStatusResponse {
  success: boolean;
  data?: {
    position: number;
    totalInQueue: number;
    estimatedWaitTime: string;
    elapsedWaitMinutes?: number;
    estimatedRemainingWaitMinutes?: number;
    concertName: string;
    artist: string;
    date: string;
    venue: string;
    isInQueue: boolean;
  };
  message?: string;
}

const QueuePage: React.FC = () => {
  const { concertId } = useParams<{ concertId: string }>();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQueueDialog, setActiveQueueDialog] = useState<{
    open: boolean;
    otherConcertId: number | null;
  }>({ open: false, otherConcertId: null });
  const [queueSwitchBusy, setQueueSwitchBusy] = useState(false);

  useEffect(() => {
    if (!activeQueueDialog.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !queueSwitchBusy) {
        setActiveQueueDialog({ open: false, otherConcertId: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeQueueDialog.open, queueSwitchBusy]);

  const fetchQueueStatus = useCallback(async () => {
    if (!concertId) {
      setLoading(false);
      setError('Missing concert id.');
      return;
    }

    try {
      const userIdParam = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
      const response = await fetch(`${API_BASE}/api/queue/${concertId}${userIdParam}`);
      const payload = (await response.json()) as QueueStatusResponse;

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.message || 'Unable to load queue status.');
        setLoading(false);
        return;
      }

      setQueueStatus({
        position: payload.data.position,
        totalInQueue: payload.data.totalInQueue,
        estimatedWaitTime: payload.data.estimatedWaitTime,
        elapsedWaitMinutes: payload.data.elapsedWaitMinutes,
        estimatedRemainingWaitMinutes: payload.data.estimatedRemainingWaitMinutes,
        concertName: payload.data.concertName,
        artist: payload.data.artist,
        date: payload.data.date,
        venue: payload.data.venue,
      });
      setIsInQueue(payload.data.isInQueue);
      setError(null);
      setLoading(false);
    } catch {
      setError('Unable to connect to server.');
      setLoading(false);
    }
  }, [concertId, user?.id]);

  useEffect(() => {
    void fetchQueueStatus();
    const interval = setInterval(() => {
      void fetchQueueStatus();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchQueueStatus]);

  const handleJoinQueue = async () => {
    if (!concertId || !user?.id) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertId, userId: user.id }),
      });
      const payload = (await res.json()) as { success: boolean; message?: string; activeConcertId?: number };
      if (!res.ok || !payload.success) {
        if (payload.activeConcertId != null) {
          setActiveQueueDialog({ open: true, otherConcertId: payload.activeConcertId });
          return;
        }
        window.alert(payload.message || 'Unable to join queue.');
        return;
      }
      setIsInQueue(true);
      if (payload.message) {
        addNotification({
          title: payload.message.includes('expired') ? 'Queue Rejoined' : 'Queue Joined',
          message: payload.message,
          type: payload.message.includes('expired') ? 'info' : 'success',
          duration: 5000,
        });
      }
      await fetchQueueStatus();
    } catch {
      window.alert('Unable to connect to server.');
    }
  };

  const closeConflictDialog = () => {
    if (queueSwitchBusy) return;
    setActiveQueueDialog({ open: false, otherConcertId: null });
  };

  const handleLeaveOtherQueueAndJoinThis = async () => {
    const otherId = activeQueueDialog.otherConcertId;
    if (!concertId || !user?.id || otherId == null) return;
    setQueueSwitchBusy(true);
    try {
      const leaveRes = await fetch(`${API_BASE}/api/queue/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertId: otherId, userId: user.id }),
      });
      const leavePayload = (await leaveRes.json()) as { success: boolean; message?: string };
      if (!leaveRes.ok || !leavePayload.success) {
        window.alert(leavePayload.message || 'Could not leave the other queue.');
        return;
      }
      const joinRes = await fetch(`${API_BASE}/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertId, userId: user.id }),
      });
      const joinPayload = (await joinRes.json()) as { success: boolean; message?: string; activeConcertId?: number };
      if (!joinRes.ok || !joinPayload.success) {
        setActiveQueueDialog({ open: false, otherConcertId: null });
        window.alert(
          joinPayload.message ||
            'You left the other queue, but joining this one failed. Try “Join Queue” again.',
        );
        return;
      }
      setActiveQueueDialog({ open: false, otherConcertId: null });
      setIsInQueue(true);
      if (joinPayload.message) {
        addNotification({
          title: joinPayload.message.includes('expired') ? 'Queue Rejoined' : 'Queue Joined',
          message: joinPayload.message,
          type: joinPayload.message.includes('expired') ? 'info' : 'success',
          duration: 5000,
        });
      }
      await fetchQueueStatus();
    } catch {
      window.alert('Unable to connect to server.');
    } finally {
      setQueueSwitchBusy(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!concertId || !user?.id) {
      setIsInQueue(false);
      navigate('/home');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/queue/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertId, userId: user.id }),
      });
      const payload = (await res.json()) as { success: boolean; message?: string };

      if (!res.ok || !payload.success) {
        window.alert(payload.message || 'Unable to leave queue right now.');
        return;
      }

      setIsInQueue(false);
      navigate('/home');
    } catch {
      window.alert('Unable to connect to server.');
    }
  };

  const handleProceedToSeating = () => {
    navigate(`/seating/${concertId}`);
  };

  if (loading) {
    return (
      <div className="queue-page loading">
        <p>Loading queue information...</p>
      </div>
    );
  }

  if (!queueStatus) {
    return (
      <div className="queue-page error">
        <h2>Queue not found</h2>
        {error && <p>{error}</p>}
        <Link to="/home">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="queue-page">
      {activeQueueDialog.open && (
        <div
          className="confirm-dialog-overlay"
          role="presentation"
          onClick={closeConflictDialog}
          onKeyDown={(e) => e.key === 'Escape' && closeConflictDialog()}
        >
          <div
            className="confirm-dialog queue-conflict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-conflict-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="queue-conflict-title" className="confirm-dialog-title">
              Already in a queue
            </h2>
            <div className="confirm-dialog-message">
              <p>You’re already in line for another concert.</p>
            </div>
            <div className="queue-conflict-dialog-actions">
              <button
                type="button"
                className="confirm-dialog-btn confirm--primary queue-conflict-btn-primary"
                disabled={queueSwitchBusy}
                onClick={handleLeaveOtherQueueAndJoinThis}
              >
                {queueSwitchBusy ? 'Processing…' : 'Join Current Queue'}
              </button>
              <button
                type="button"
                className="confirm-dialog-btn queue-conflict-btn-outline"
                disabled={queueSwitchBusy}
                onClick={() => {
                  const id = activeQueueDialog.otherConcertId;
                  closeConflictDialog();
                  if (id != null) navigate(`/queue/${id}`);
                }}
              >
                View Other Queue
              </button>
              <button
                type="button"
                className="confirm-dialog-btn cancel queue-conflict-btn-secondary"
                disabled={queueSwitchBusy}
                onClick={closeConflictDialog}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="queue-header">
        <Link to="/home" className="back-link">← Back to Home</Link>
        <h1>Queue Status</h1>
      </header>

      <main className="queue-main">
        <div className="concert-info">
          <h2>{queueStatus.concertName}</h2>
          <p className="artist">{queueStatus.artist}</p>
          <p className="venue">{queueStatus.venue}</p>
          <p className="date">{formatLocalDateFromApi(queueStatus.date)}</p>
        </div>

        {!isInQueue ? (
          <div className="join-queue-section">
            <h3>Join the Queue</h3>
            <p>There are currently {queueStatus.totalInQueue} people in the queue.</p>
            <button onClick={handleJoinQueue} className="join-queue-btn">
              Join Queue
            </button>
          </div>
        ) : (
          <div className="queue-status-section">
            <div className="status-display">
              <div className="position-info">
                <h3>Your Position</h3>
                <div className="position-number">{queueStatus.position}</div>
                <p>out of {queueStatus.totalInQueue} people</p>
              </div>
              
              <div className="wait-time">
                <h3>Wait Time</h3>
                <p className="time">
                  {queueStatus.elapsedWaitMinutes != null
                    ? `Waited: ${queueStatus.elapsedWaitMinutes} min`
                    : queueStatus.estimatedWaitTime}
                </p>
                {queueStatus.estimatedRemainingWaitMinutes != null && (
                  <p className="time">Remaining: {queueStatus.estimatedRemainingWaitMinutes} min</p>
                )}
              </div>
            </div>

            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ 
                  width: `${queueStatus.totalInQueue > 0
                    ? ((queueStatus.totalInQueue - queueStatus.position) / queueStatus.totalInQueue) * 100
                    : 0}%` 
                }}
              ></div>
            </div>

            <div className="queue-actions">
              {queueStatus.position <= 5 && (
                <button 
                  onClick={handleProceedToSeating}
                  className="proceed-btn"
                >
                  Proceed to Seat Selection
                </button>
              )}
              
              {/* Development/Demo button to skip queue              <button 
                onClick={handleProceedToSeating}
                className="skip-queue-btn"
                style={{ backgroundColor: '#10b981', color: 'white' }}
              >
                Skip Queue (Demo)
              </button>
              */}

              <button 
                onClick={handleLeaveQueue}
                className="leave-queue-btn"
              >
                Leave Queue
              </button>
            </div>

            <div className="queue-tips">
              <h4>Queue Tips:</h4>
              <ul>
                <li>Keep this page open to maintain your position</li>
                <li>You'll be notified when it's your turn</li>
                <li>Premium pass holders get priority access</li>
              </ul>
            </div>
          </div>
        )}


      </main>
    </div>
  );
};

export default QueuePage;