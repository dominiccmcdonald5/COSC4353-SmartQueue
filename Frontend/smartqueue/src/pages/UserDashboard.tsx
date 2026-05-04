import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatLocalDateFromApi, formatPassExpiresForDisplay, parseLocalDateFromApi } from '../utils/apiDate';
import { GiPoliceBadge } from 'react-icons/gi';
import { FaDollarSign } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import '../styling/UserDashboard.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

interface SeatSelectionEntry {
  section?: string;
  row?: string;
  seatNumber?: string;
  seat?: string;
  price?: number;
}

interface QueueHistory {
  id: string;
  concertID: number;
  concertName: string;
  artist: string;
  genre: string;
  date: string;
  status: 'completed' | 'cancelled' | 'in-progress';
  waitTime: string;
  ticketsPurchased?: number;
  venue?: string;
  totalCost?: number;
  seatSelection?: SeatSelectionEntry[];
  imageUrl: string;
  queueStatus: 'secured' | 'pending' | 'sold-out';
}

type HistorySort =
  | 'date-desc'
  | 'date-asc'
  | 'name-asc'
  | 'name-desc'
  | 'status-secured-first'
  | 'status-pending-first'
  | 'status-soldout-first';

interface UserStats {
  totalQueues: number;
  successfulQueues: number;
  firstPopularGenre: string | null;
  secondPopularGenre: string | null;
  thirdPopularGenre: string | null;
  totalSpending: number;
  spendingByConcert: {
    concertID: number;
    concertName: string;
    totalSpent: number;
    queueCount: number;
  }[];
}

type PassStatus = 'Gold' | 'Silver' | 'None';

function formatSeatLine(s: SeatSelectionEntry): string {
  const sec = s.section?.trim() || '—';
  const row = s.row?.trim() || '—';
  const num = (s.seatNumber ?? s.seat)?.toString().trim() || '—';
  const p = Number(s.price);
  const pricePart = Number.isFinite(p) ? ` ($${p.toFixed(2)})` : '';
  return `Section ${sec}, Row ${row}, Seat ${num}${pricePart}`;
}

const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [queueHistory, setQueueHistory] = useState<QueueHistory[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [activeTab, setActiveTab] = useState<'history' | 'tickets' | 'stats'>('history');
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [historySort, setHistorySort] = useState<HistorySort>('status-pending-first');

  const userPassStatus: PassStatus = user?.passStatus ?? 'None';

  const topGenres = useMemo(() => {
    if (!userStats) {
      return [] as { name: string; count: number; fill: string }[];
    }

    const values = [userStats.firstPopularGenre, userStats.secondPopularGenre, userStats.thirdPopularGenre]
      .filter((genre): genre is string => Boolean(genre));
    const fallbackCounts = [3, 2, 1];
    const fills = ['#f59e0b', '#9ca3af', '#cd7f32'];

    return values.map((genre, index) => ({
      name: genre,
      count: fallbackCounts[index] || 1,
      fill: fills[index] || '#9ca3af',
    }));
  }, [userStats]);

  const spendingByConcert = useMemo(() => {
    if (!userStats) {
      return [] as { id: number; label: string; value: number; color: string }[];
    }

    const colors = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7', '#06b6d4'];
    return userStats.spendingByConcert
      .filter((item) => Number(item.totalSpent) > 0)
      .map((item, index) => ({
        id: item.concertID,
        label: item.concertName,
        value: item.totalSpent,
        color: colors[index % colors.length],
      }));
  }, [userStats]);

  const successPercent = useMemo(() => {
    if (!userStats || userStats.totalQueues === 0) {
      return 0;
    }
    return Math.round((userStats.successfulQueues / userStats.totalQueues) * 100);
  }, [userStats]);

  const spendingChartGradient = useMemo(() => {
    if (!userStats || userStats.totalSpending <= 0 || spendingByConcert.length === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let currentAngle = 0;
    const segments = spendingByConcert.map((item) => {
      const angle = (item.value / userStats.totalSpending) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;
      currentAngle = end;
      return `${item.color} ${start}deg ${end}deg`;
    });

    if (currentAngle < 360) {
      segments.push(`#e5e7eb ${currentAngle}deg 360deg`);
    }

    return `conic-gradient(${segments.join(',')})`;
  }, [spendingByConcert, userStats]);

  useEffect(() => {
    const loadUserHistory = async () => {
      const parsedUserId = Number(user?.id || 0);
      if (!parsedUserId) {
        setHistoryError('Unable to determine user ID for history lookup');
        setQueueHistory([]);
        return;
      }

      try {
        setHistoryLoading(true);
        setHistoryError('');

        const response = await fetch(`${API_BASE}/api/user/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userID: parsedUserId }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load user history');
        }

        const mappedHistory: QueueHistory[] = (data.concerts || []).map((concert: any) => {
          const history = concert.history || {};
          const historyStatus = history.status || 'queued';
          const imageUrl =
            concert.concertImage ||
            concert.concert_image ||
            '/concert1.jpg';
          const rawSeats = history.seatSelection ?? history.seat_selection;
          let seatSelection: SeatSelectionEntry[] | undefined;
          if (Array.isArray(rawSeats) && rawSeats.length > 0) {
            seatSelection = rawSeats as SeatSelectionEntry[];
          }

          return {
            id: String(history.historyID ?? history.history_id ?? concert.concertID ?? concert.concert_id),
            concertID: Number(concert.concertID ?? concert.concert_id),
            concertName: concert.concertName ?? concert.concert_name,
            artist: concert.artistName ?? concert.artist_name,
            genre: concert.genre,
            date: concert.date ?? concert.event_date,
            venue: concert.venue != null ? String(concert.venue) : undefined,
            totalCost: Number(history.totalCost ?? history.total_cost ?? 0),
            seatSelection,
            status: historyStatus === 'completed' ? 'completed' : historyStatus === 'cancelled' ? 'cancelled' : 'in-progress',
            waitTime: `${history.waitTime ?? history.wait_time ?? 0} seconds`,
            ticketsPurchased: history.ticketCount ?? history.ticket_count,
            imageUrl,
            queueStatus: historyStatus === 'completed' ? 'secured' : historyStatus === 'cancelled' ? 'sold-out' : 'pending',
          };
        });

        setQueueHistory(mappedHistory);
      } catch (error: unknown) {
        if (error instanceof Error) {
          setHistoryError(error.message);
        } else {
          setHistoryError('Failed to load user history');
        }
        setQueueHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    const loadUserStats = async () => {
      const parsedUserId = Number(user?.id || 0);
      if (!parsedUserId) {
        setStatsError('Unable to determine user ID for stats lookup');
        setUserStats(null);
        return;
      }

      try {
        setStatsLoading(true);
        setStatsError('');

        const response = await fetch(`${API_BASE}/api/user/stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userID: parsedUserId }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load user stats');
        }

        setUserStats({
          totalQueues: Number(data.totalQueues ?? 0),
          successfulQueues: Number(data.successfulQueues ?? 0),
          firstPopularGenre: data.firstPopularGenre ?? null,
          secondPopularGenre: data.secondPopularGenre ?? null,
          thirdPopularGenre: data.thirdPopularGenre ?? null,
          totalSpending: Number(data.totalSpending ?? 0),
          spendingByConcert: Array.isArray(data.spendingByConcert) ? data.spendingByConcert : [],
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          setStatsError(error.message);
        } else {
          setStatsError('Failed to load user stats');
        }
        setUserStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    loadUserHistory();
    loadUserStats();
  }, [user?.id]);

  const sortedQueueHistory = useMemo(() => {
    const list = [...queueHistory];
    const dateMs = (d: string) => parseLocalDateFromApi(d)?.getTime() ?? 0;
    const statusRank = (q: QueueHistory) =>
      q.queueStatus === 'secured' ? 0 : q.queueStatus === 'pending' ? 1 : 2;

    switch (historySort) {
      case 'date-desc':
        return list.sort((a, b) => dateMs(b.date) - dateMs(a.date));
      case 'date-asc':
        return list.sort((a, b) => dateMs(a.date) - dateMs(b.date));
      case 'name-asc':
        return list.sort((a, b) => a.concertName.localeCompare(b.concertName, undefined, { sensitivity: 'base' }));
      case 'name-desc':
        return list.sort((a, b) => b.concertName.localeCompare(a.concertName, undefined, { sensitivity: 'base' }));
      case 'status-secured-first':
        return list.sort((a, b) => {
          const dr = statusRank(a) - statusRank(b);
          return dr !== 0 ? dr : dateMs(b.date) - dateMs(a.date);
        });
      case 'status-pending-first':
        return list.sort((a, b) => {
          const order = (q: QueueHistory) =>
            q.queueStatus === 'pending' ? 0 : q.queueStatus === 'secured' ? 1 : 2;
          const dr = order(a) - order(b);
          return dr !== 0 ? dr : dateMs(b.date) - dateMs(a.date);
        });
      case 'status-soldout-first':
        return list.sort((a, b) => {
          const order = (q: QueueHistory) =>
            q.queueStatus === 'sold-out' ? 0 : q.queueStatus === 'pending' ? 1 : 2;
          const dr = order(a) - order(b);
          return dr !== 0 ? dr : dateMs(b.date) - dateMs(a.date);
        });
      default:
        return list;
    }
  }, [queueHistory, historySort]);

  const purchasedTickets = useMemo(() => {
    const dateMs = (d: string) => parseLocalDateFromApi(d)?.getTime() ?? 0;
    return queueHistory
      .filter((q) => q.queueStatus === 'secured' && (q.ticketsPurchased ?? 0) > 0)
      .sort((a, b) => dateMs(b.date) - dateMs(a.date));
  }, [queueHistory]);

  const getBadgeInfo = () => {
    switch (userPassStatus) {
      case 'Silver':
        return {
          label: 'Silver',
          color: '#c0c0c0',
          description: 'Skip the line until 25% venue capacity is filled',
        };
      case 'Gold':
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
  const passExpiryTitle = user?.passExpiresAt
    ? `Expires ${formatPassExpiresForDisplay(user.passExpiresAt)}`
    : undefined;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h1>My Dashboard</h1>
          <div className="header-actions">
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="user-profile">
          <div className="profile-info">
            <div className="user-name-section">
              <h2>
                Welcome back, {user?.name}!
                {badgeInfo && (
                  <span
                    className="styled-tooltip pass-badge-tooltip-wrap"
                    data-tooltip={
                      passExpiryTitle
                        ? `${passExpiryTitle} — click for details`
                        : `Click to see ${badgeInfo.label} pass details`
                    }
                  >
                    <GiPoliceBadge
                      className="pass-badge-icon"
                      style={{ color: badgeInfo.color }}
                      onClick={() => setShowBadgePopup(true)}
                    />
                  </span>
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
            className={`tab ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            My Tickets
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
            <div className="history-history-header">
              <h3>Your Queue History</h3>
              {!historyLoading && !historyError && queueHistory.length > 0 && (
                <div className="history-toolbar">
                  <label htmlFor="history-sort" className="history-sort-label">
                    Order list by
                  </label>
                  <select
                    id="history-sort"
                    className="history-sort-select"
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value as HistorySort)}
                  >
                    <optgroup label="By show date">
                      <option value="date-desc">Newest first</option>
                      <option value="date-asc">Oldest first</option>
                    </optgroup>
                    <optgroup label="By concert name">
                      <option value="name-asc">A to Z</option>
                      <option value="name-desc">Z to A</option>
                    </optgroup>
                    <optgroup label="By status">
                      <option value="status-secured-first">Secured</option>
                      <option value="status-pending-first">In queue</option>
                      <option value="status-soldout-first">Sold out</option>
                    </optgroup>
                  </select>
                </div>
              )}
            </div>
            {historyLoading && <p>Loading history...</p>}
            {historyError && <p className="error-message">{historyError}</p>}
            <div className="history-list">
              {!historyLoading && !historyError && queueHistory.length === 0 && (
                <p>No history found for this user.</p>
              )}
              {sortedQueueHistory.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="concert-image">
                    <img
                      src={item.imageUrl}
                      alt={item.concertName}
                      onError={(e) => {
                        e.currentTarget.src = '/concert1.jpg';
                      }}
                    />
                  </div>
                  <div className="concert-details">
                    <div className="concert-main-info">
                      <h4 className="concert-name">{item.concertName}</h4>
                      <p className="concert-artist">{item.artist}</p>
                      <div className="concert-meta">
                        <span className="concert-genre">{item.genre}</span>
                        <span className="concert-date">{formatLocalDateFromApi(item.date)}</span>
                      </div>
                      <div className="queue-metrics-inline">
                        <span className="metric-inline">Wait Time: {item.waitTime}</span>
                        {item.ticketsPurchased && (
                          <span className="metric-inline">Tickets: {item.ticketsPurchased}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`queue-status-indicator ${item.queueStatus}`}>
                    {item.queueStatus === 'secured' && (
                      <>
                        <span className="status-dot"></span>
                        <span className="status-text">Secured</span>
                      </>
                    )}
                    {item.queueStatus === 'pending' && (
                      <>
                        <span className="status-dot"></span>
                        <span className="status-text">In Queue</span>
                      </>
                    )}
                    {item.queueStatus === 'sold-out' && (
                      <>
                        <span className="status-dot"></span>
                        <span className="status-text">Sold Out</span>
                      </>
                    )}
                    {item.queueStatus === 'pending' && (
                      <Link className="resume-queue-link" to={`/queue/${item.concertID}`}>
                        Open Queue
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'tickets' && (
          <section className="queue-history tickets-panel">
            <div className="history-history-header">
              <h3>My Tickets</h3>
              <p className="tickets-tab-lead">Purchases tied to your completed queue orders.</p>
            </div>
            {historyLoading && <p>Loading history...</p>}
            {historyError && <p className="error-message">{historyError}</p>}
            {!historyLoading && !historyError && purchasedTickets.length === 0 && (
              <p>No ticket purchases yet.</p>
            )}
            <div className="history-list">
              {!historyLoading &&
                !historyError &&
                purchasedTickets.map((item) => (
                  <div key={item.id} className="history-item ticket-purchase-card">
                    <div className="concert-image">
                      <img
                        src={item.imageUrl}
                        alt={item.concertName}
                        onError={(e) => {
                          e.currentTarget.src = '/concert1.jpg';
                        }}
                      />
                    </div>
                    <div className="concert-details">
                      <div className="concert-main-info">
                        <h4 className="concert-name">{item.concertName}</h4>
                        <p className="concert-artist">{item.artist}</p>
                        <div className="concert-meta">
                          <span className="concert-genre">{item.genre}</span>
                          <span className="concert-date">{formatLocalDateFromApi(item.date)}</span>
                        </div>
                        {item.venue ? (
                          <p className="ticket-venue-line">
                            <strong>Venue:</strong> {item.venue}
                          </p>
                        ) : null}
                        <div className="queue-metrics-inline">
                          <span className="metric-inline">
                            Tickets: {item.ticketsPurchased ?? 0}
                          </span>
                          {item.totalCost != null && item.totalCost > 0 ? (
                            <span className="metric-inline">
                              Paid: ${item.totalCost.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                        {item.seatSelection && item.seatSelection.length > 0 ? (
                          <ul className="ticket-seat-list">
                            {item.seatSelection.map((s, idx) => (
                              <li key={`${item.id}-seat-${idx}`}>{formatSeatLine(s)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ticket-seat-missing">Seat details not stored for this order.</p>
                        )}
                      </div>
                    </div>
                    <div className="queue-status-indicator secured">
                      <span className="status-dot" />
                      <span className="status-text">Purchased</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {activeTab === 'stats' && userStats && (
          <section className="user-stats">
            <h3>Your Concert Statistics</h3>
            {statsLoading && <p>Loading stats...</p>}
            {statsError && <p className="error-message">{statsError}</p>}
            
            {/* Success Rate Container */}
            <div className="stats-container success-container">
              <div className="pie-chart-container">
                <div className="success-pie-chart">
                  <div 
                    className="pie-chart-circle"
                    style={{
                      background: `conic-gradient(
                        #10b981 0deg ${(userStats.totalQueues > 0 ? userStats.successfulQueues / userStats.totalQueues : 0) * 360}deg,
                        #e5e7eb ${(userStats.totalQueues > 0 ? userStats.successfulQueues / userStats.totalQueues : 0) * 360}deg 360deg
                      )`
                    }}
                  >
                    <div className="pie-chart-center">
                      <span className="success-percentage">
                        {successPercent}%
                      </span>
                      <span className="success-label">Success Rate</span>
                    </div>
                  </div>
                </div>
                <div className="success-details">
                  <h4>Performance Level</h4>
                  <p className="performance-level">
                    {successPercent >= 80 ? 'Expert' :
                     successPercent >= 60 ? 'Advanced' :
                     successPercent >= 40 ? 'Intermediate' : 'Beginner'}
                  </p>
                  <div className="queue-stats">
                    <div className="queue-stat">
                      <span className="stat-value">{userStats.totalQueues}</span>
                      <span className="stat-label">Total Queues</span>
                    </div>
                    <div className="queue-stat">
                      <span className="stat-value">{userStats.successfulQueues}</span>
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
              </div>
            </div>

            {/* Spending Pie Chart Container */}
            <div className="stats-container spending-container">
              <div className="spending-chart-container">
                <div className="spending-total">
                  <h4>Total Spending</h4>
                  <p className="total-amount">${userStats.totalSpending.toFixed(2)}</p>
                  <p className="spending-instruction">Hover over the chart to see breakdown</p>
                </div>
                <div className="custom-pie-container">
                  <div 
                    className="custom-pie-chart"
                    style={{
                      background: spendingChartGradient
                    }}
                  >
                    <div className="pie-center">
                      <FaDollarSign className="pie-center-icon" />
                    </div>
                  </div>
                  <div className="pie-legend">
                    {spendingByConcert.map((item, index) => (
                      <div key={index} className="legend-item" title={`${item.label}: $${item.value.toFixed(2)}`}>
                        <div className="legend-dot" style={{ backgroundColor: item.color }}></div>
                        <span className="legend-label">{item.label}</span>
                        <span className="legend-value">${item.value.toFixed(2)}</span>
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
                {user?.passExpiresAt && (
                  <p className="badge-expiry">
                    <strong>Expires:</strong> {formatPassExpiresForDisplay(user.passExpiresAt)}
                  </p>
                )}
                {userPassStatus === 'Silver' && (
                  <p className="badge-upgrade">
                    <Link to="/purchase-pass" onClick={() => setShowBadgePopup(false)}>
                      Upgrade to Gold
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UserDashboard;