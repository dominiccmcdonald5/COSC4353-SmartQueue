import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const QueuePage: React.FC = () => {
  const { concertId } = useParams<{ concertId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!concertId) return;

    // TODO: Replace with actual API call
    // Mock data for demonstration
    setTimeout(() => {
      const mockQueueStatus: QueueStatus = {
        position: Math.floor(Math.random() * 1000) + 1,
        totalInQueue: 2500,
        estimatedWaitTime: `${Math.floor(Math.random() * 60) + 10} minutes`,
        concertName: 'Summer Music Festival',
        artist: 'Various Artists',
        date: '2026-07-15',
        venue: 'Central Park',
      };
      setQueueStatus(mockQueueStatus);
      setIsInQueue(true);
      setLoading(false);
    }, 1000);

    // Simulate queue position updates
    const interval = setInterval(() => {
      setQueueStatus(prev => {
        if (!prev) return prev;
        const newPosition = Math.max(1, prev.position - Math.floor(Math.random() * 5));
        return {
          ...prev,
          position: newPosition,
          estimatedWaitTime: `${Math.max(1, parseInt(prev.estimatedWaitTime) - 1)} minutes`,
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [concertId]);

  const handleJoinQueue = () => {
    setIsInQueue(true);
    // TODO: API call to join queue
  };

  const handleLeaveQueue = () => {
    setIsInQueue(false);
    navigate('/home');
    // TODO: API call to leave queue
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
        <Link to="/home">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="queue-page">
      <header className="queue-header">
        <Link to="/home" className="back-link">← Back to Home</Link>
        <h1>Queue Status</h1>
      </header>

      <main className="queue-main">
        <div className="concert-info">
          <h2>{queueStatus.concertName}</h2>
          <p className="artist">{queueStatus.artist}</p>
          <p className="venue">{queueStatus.venue}</p>
          <p className="date">{new Date(queueStatus.date).toLocaleDateString()}</p>
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
              
              {/* Development/Demo button to skip queue */}
              <button 
                onClick={handleProceedToSeating}
                className="skip-queue-btn"
                style={{ backgroundColor: '#10b981', color: 'white' }}
              >
                Skip Queue (Demo)
              </button>
              
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

        <div className="user-info">
          <p>Logged in as: {user?.name}</p>
          <Link to="/purchase-pass" className="premium-link">
            Get Premium Pass for Priority Access
          </Link>
        </div>
      </main>
    </div>
  );
};

export default QueuePage;