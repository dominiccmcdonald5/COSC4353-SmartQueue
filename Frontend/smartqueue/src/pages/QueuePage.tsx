import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatLocalDateFromApi } from '../utils/apiDate';
import '../components/ui/ConfirmDialog.css';
import '../styling/QueuePage.css';

interface QueueStatus {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: string;
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

  useEffect(() => {
    if (!concertId) {
      setLoading(false);
      setError('Missing concert id.');
      return;
    }

    let mounted = true;

    const fetchQueueStatus = async () => {
      try {
        const userIdParam = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
        const response = await fetch(`http://localhost:5000/api/queue/${concertId}${userIdParam}`);
        const payload = (await response.json()) as QueueStatusResponse;

        if (!mounted) return;

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.message || 'Unable to load queue status.');
          setLoading(false);
          return;
        }

        setQueueStatus({
          position: payload.data.position,
          totalInQueue: payload.data.totalInQueue,
          estimatedWaitTime: payload.data.estimatedWaitTime,
          concertName: payload.data.concertName,
          artist: payload.data.artist,
          date: payload.data.date,
          venue: payload.data.venue,
        });
        setIsInQueue(payload.data.isInQueue);
        setError(null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setError('Unable to connect to server.');
        setLoading(false);
      }
    };

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [concertId, user?.id]);

  const handleJoinQueue = async () => {
    if (!concertId || !user?.id) {
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/queue/join', {
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
      // Queue status is re-polled every 5 seconds by useEffect.
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
      const leaveRes = await fetch('http://localhost:5000/api/queue/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concertId: otherId, userId: user.id }),
      });
      const leavePayload = (await leaveRes.json()) as { success: boolean; message?: string };
      if (!leaveRes.ok || !leavePayload.success) {
        window.alert(leavePayload.message || 'Could not leave the other queue.');
        return;
      }
      const joinRes = await fetch('http://localhost:5000/api/queue/join', {
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
      const res = await fetch('http://localhost:5000/api/queue/leave', {
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
                <h3>Estimated Wait Time</h3>
                <p className="time">{queueStatus.estimatedWaitTime}</p>
              </div>
            </div>

            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ 
                  width: `${((queueStatus.totalInQueue - queueStatus.position) / queueStatus.totalInQueue) * 100}%` 
                }}
              ></div>
            </div>

            <div className="queue-actions">
              {queueStatus.position <= 10 && (
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