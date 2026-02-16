import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GiPoliceBadge } from 'react-icons/gi';
import '../styling/UserDashboard.css';

interface QueueHistory {
  id: string;
  concertName: string;
  artist: string;
  date: string;
  status: 'completed' | 'cancelled' | 'in-progress';
  waitTime: string;
  ticketsPurchased?: number;
}

interface UserStats {
  totalQueues: number;
  successfulPurchases: number;
  averageWaitTime: string;
  favoriteGenre: string;
  totalSpent: number;
}

type PassStatus = 'none' | 'silver' | 'gold';

const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [queueHistory, setQueueHistory] = useState<QueueHistory[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const [showBadgePopup, setShowBadgePopup] = useState(false);

  // Mock user pass status - replace with actual user data
  const userPassStatus: PassStatus = 'gold' as PassStatus;

  useEffect(() => {
    // TODO: Replace with actual API calls
    // Mock data for demonstration
    const mockHistory: QueueHistory[] = [
      {
        id: '1',
        concertName: 'Summer Music Festival',
        artist: 'Various Artists',
        date: '2026-07-15',
        status: 'completed',
        waitTime: '45 minutes',
        ticketsPurchased: 2,
      },
      {
        id: '2',
        concertName: 'Rock Night',
        artist: 'The Electric Band',
        date: '2026-06-20',
        status: 'in-progress',
        waitTime: '12 minutes',
      },
      {
        id: '3',
        concertName: 'Pop Extravaganza',
        artist: 'PopStar',
        date: '2026-05-10',
        status: 'cancelled',
        waitTime: '23 minutes',
      },
    ];

    const mockStats: UserStats = {
      totalQueues: 15,
      successfulPurchases: 12,
      averageWaitTime: '35 minutes',
      favoriteGenre: 'Rock',
      totalSpent: 850,
    };

    setQueueHistory(mockHistory);
    setUserStats(mockStats);
  }, []);

  const getBadgeInfo = () => {
    switch (userPassStatus) {
      case 'silver':
        return {
          label: 'Silver',
          color: '#c0c0c0',
          description: 'Skip the line until 25% venue capacity is filled',
        };
      case 'gold':
        return {
          label: 'Gold',
          color: '#ffd700',
          description: 'Skip the line until 50% venue capacity is filled',
        };
      default:
        return null;
    }
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h1>My Dashboard</h1>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="user-profile">
          <div className="profile-info">
            <div className="user-name-section">
              <h2>
                Welcome back, {user?.name}!
                {badgeInfo && (
                  <GiPoliceBadge 
                    className="pass-badge-icon"
                    style={{ color: badgeInfo.color }}
                    onClick={() => setShowBadgePopup(true)}
                    title={`Click to see ${badgeInfo.label} pass details`}
                  />
                )}
              </h2>
            </div>
            <p>{user?.email}</p>
          </div>
        </div>

        <div className="dashboard-tabs">
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Queue History
          </button>
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            My Stats
          </button>
        </div>

        {activeTab === 'history' && (
          <section className="queue-history">
            <h3>Your Queue History</h3>
            <div className="history-list">
              {queueHistory.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="concert-info">
                    <h4>{item.concertName}</h4>
                    <p className="artist">{item.artist}</p>
                    <p className="date">{new Date(item.date).toLocaleDateString()}</p>
                  </div>
                  <div className="queue-info">
                    <div className={`status ${item.status}`}>
                      {item.status === 'completed' && '✅ Completed'}
                      {item.status === 'in-progress' && '⏳ In Progress'}
                      {item.status === 'cancelled' && '❌ Cancelled'}
                    </div>
                    <p className="wait-time">Wait Time: {item.waitTime}</p>
                    {item.ticketsPurchased && (
                      <p className="tickets">Tickets Purchased: {item.ticketsPurchased}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'stats' && userStats && (
          <section className="user-stats">
            <h3>Your Concert Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Queues Joined</h4>
                <p className="stat-number">{userStats.totalQueues}</p>
              </div>
              <div className="stat-card">
                <h4>Successful Purchases</h4>
                <p className="stat-number">{userStats.successfulPurchases}</p>
              </div>
              <div className="stat-card">
                <h4>Average Wait Time</h4>
                <p className="stat-number">{userStats.averageWaitTime}</p>
              </div>
              <div className="stat-card">
                <h4>Favorite Genre</h4>
                <p className="stat-number">{userStats.favoriteGenre}</p>
              </div>
              <div className="stat-card">
                <h4>Total Spent</h4>
                <p className="stat-number">${userStats.totalSpent}</p>
              </div>
              <div className="stat-card">
                <h4>Success Rate</h4>
                <p className="stat-number">
                  {Math.round((userStats.successfulPurchases / userStats.totalQueues) * 100)}%
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="dashboard-actions">
          <Link to="/purchase-pass" className="action-link">
            Upgrade to Premium Pass
          </Link>
        </section>

        {/* Badge Popup Modal */}
        {showBadgePopup && badgeInfo && (
          <div className="badge-popup-overlay" onClick={() => setShowBadgePopup(false)}>
            <div className="badge-popup" onClick={(e) => e.stopPropagation()}>
              <div className="badge-popup-header">
                <h3>
                  <GiPoliceBadge 
                    className="popup-badge-icon"
                    style={{ color: badgeInfo.color }}
                  />
                  {badgeInfo.label} Pass Status
                </h3>
                <button 
                  className="close-popup"
                  onClick={() => setShowBadgePopup(false)}
                >
                  ×
                </button>
              </div>
              <div className="badge-popup-content">
                <p className="badge-description">{badgeInfo.description}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UserDashboard;