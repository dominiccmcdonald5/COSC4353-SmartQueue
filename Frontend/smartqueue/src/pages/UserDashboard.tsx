import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GiPoliceBadge } from 'react-icons/gi';
import { FaTicketAlt, FaClock, FaMusic, FaDollarSign, FaChartLine, FaTrophy } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ResponsivePie } from '@nivo/pie';
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

  // Mock data for enhanced stats
  const topGenres = [
    { name: 'Pop', count: 2, percentage: 25, fill: '#9ca3af' },     // 2nd place (left)
    { name: 'Rock', count: 4, percentage: 50, fill: '#f59e0b' },    // 1st place (middle)
    { name: 'Jazz', count: 2, percentage: 25, fill: '#cd7f32' },    // 3rd place (right)
  ];

  const spendingByConcert = [
    { id: 'Summer Rock Festival', label: 'Summer Rock Festival', value: 150, color: '#667eea' },
    { id: 'Pop Stars Live', label: 'Pop Stars Live', value: 120, color: '#764ba2' },
    { id: 'Jazz Night', label: 'Jazz Night', value: 80, color: '#10b981' },
    { id: 'Indie Showcase', label: 'Indie Showcase', value: 100, color: '#f59e0b' },
  ];

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
            
            {/* Success Rate Container */}
            <div className="stats-container success-container">
              <div className="pie-chart-container">
                <div className="success-pie-chart">
                  <div 
                    className="pie-chart-circle"
                    style={{
                      background: `conic-gradient(
                        #10b981 0deg ${(userStats.successfulPurchases / userStats.totalQueues) * 360}deg,
                        #e5e7eb ${(userStats.successfulPurchases / userStats.totalQueues) * 360}deg 360deg
                      )`
                    }}
                  >
                    <div className="pie-chart-center">
                      <span className="success-percentage">
                        {Math.round((userStats.successfulPurchases / userStats.totalQueues) * 100)}%
                      </span>
                      <span className="success-label">Success Rate</span>
                    </div>
                  </div>
                </div>
                <div className="success-details">
                  <h4>Performance Level</h4>
                  <p className="performance-level">
                    {Math.round((userStats.successfulPurchases / userStats.totalQueues) * 100) >= 80 ? 'Expert' :
                     Math.round((userStats.successfulPurchases / userStats.totalQueues) * 100) >= 60 ? 'Advanced' :
                     Math.round((userStats.successfulPurchases / userStats.totalQueues) * 100) >= 40 ? 'Intermediate' : 'Beginner'}
                  </p>
                  <div className="queue-stats">
                    <div className="queue-stat">
                      <span className="stat-value">{userStats.totalQueues}</span>
                      <span className="stat-label">Total Queues</span>
                    </div>
                    <div className="queue-stat">
                      <span className="stat-value">{userStats.successfulPurchases}</span>
                      <span className="stat-label">Successful</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Genre Podium Container */}
            <div className="stats-container podium-container">
              <h4>Top Genres</h4>
              <div className="recharts-podium">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={topGenres}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 14, fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Bar 
                      dataKey="count" 
                      radius={[8, 8, 0, 0]}
                      label={{ position: 'top', fontSize: 14, fontWeight: 'bold' }}
                    >
                      {topGenres.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="podium-labels">
                  <div className="podium-rank">
                    <FaTrophy style={{ color: '#f59e0b', fontSize: '1.5rem' }} />
                    <span>1st Place</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Spending Pie Chart Container */}
            <div className="stats-container spending-container">
              <div className="spending-chart-container">
                <div className="spending-total">
                  <h4>Total Spending</h4>
                  <p className="total-amount">${userStats.totalSpent}</p>
                  <p className="spending-instruction">Hover over the chart to see breakdown</p>
                </div>
                <div className="custom-pie-container">
                  <div 
                    className="custom-pie-chart"
                    style={{
                      background: `conic-gradient(
                        ${spendingByConcert[0].color} 0deg ${(spendingByConcert[0].value / userStats.totalSpent) * 360}deg,
                        ${spendingByConcert[1].color} ${(spendingByConcert[0].value / userStats.totalSpent) * 360}deg ${((spendingByConcert[0].value + spendingByConcert[1].value) / userStats.totalSpent) * 360}deg,
                        ${spendingByConcert[2].color} ${((spendingByConcert[0].value + spendingByConcert[1].value) / userStats.totalSpent) * 360}deg ${((spendingByConcert[0].value + spendingByConcert[1].value + spendingByConcert[2].value) / userStats.totalSpent) * 360}deg,
                        ${spendingByConcert[3].color} ${((spendingByConcert[0].value + spendingByConcert[1].value + spendingByConcert[2].value) / userStats.totalSpent) * 360}deg 360deg
                      )`
                    }}
                  >
                    <div className="pie-center">
                      <FaDollarSign className="pie-center-icon" />
                    </div>
                  </div>
                  <div className="pie-legend">
                    {spendingByConcert.map((item, index) => (
                      <div key={index} className="legend-item" title={`${item.label}: $${item.value}`}>
                        <div className="legend-dot" style={{ backgroundColor: item.color }}></div>
                        <span className="legend-label">{item.label}</span>
                        <span className="legend-value">${item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

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