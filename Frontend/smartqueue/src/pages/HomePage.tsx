import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styling/HomePage.css';

interface Concert {
  id: string;
  name: string;
  artist: string;
  date: string;
  venue: string;
  image: string;
  price: string;
  status: 'available' | 'sold-out' | 'queue-active';
  availableTickets?: number;
  totalTickets?: number;
  genre?: string;
}

const HomePage: React.FC = () => {
  const { user, logout, isAdmin, isUser } = useAuth();
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConcerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/concerts');
        const data = await response.json();
        if (data.success) {
          setConcerts(data.concerts);
        } else {
          setError('Failed to load concerts');
          // Fallback to mock data if API fails
          loadMockData();
        }
      } catch (error) {
        console.error('Error fetching concerts:', error);
        setError('Unable to connect to server. Showing demo data.');
        // Fallback to mock data if API fails
        loadMockData();
      } finally {
        setLoading(false);
      }
    };
    
    const loadMockData = () => {
      const mockConcerts: Concert[] = [
        {
          id: '1',
          name: 'Summer Music Festival',
          artist: 'Various Artists',
          date: '2026-07-15',
          venue: 'Central Park',
          image: 'https://picsum.photos/seed/summer-festival/600/400',
          price: '$85 - $150',
          status: 'available',
          availableTickets: 450,
          totalTickets: 1000,
          genre: 'Various'
        },
        {
          id: '2',
          name: 'Rock Night',
          artist: 'The Electric Band',
          date: '2026-06-20',
          venue: 'Madison Square Garden',
          image: 'https://picsum.photos/seed/rock-night/600/400',
          price: '$95 - $200',
          status: 'queue-active',
          availableTickets: 120,
          totalTickets: 800,
          genre: 'Rock'
        },
        {
          id: '3',
          name: 'Jazz Evening',
          artist: 'Miles & Friends',
          date: '2026-05-30',
          venue: 'Blue Note',
          image: 'https://picsum.photos/seed/jazz-evening/600/400',
          price: '$65 - $120',
          status: 'sold-out',
          availableTickets: 0,
          totalTickets: 500,
          genre: 'Jazz'
        },
        {
          id: '4',
          name: 'EDM Paradise',
          artist: 'DJ Neon',
          date: '2026-08-10',
          venue: 'Electric Factory',
          image: 'https://picsum.photos/seed/edm-paradise/600/400',
          price: '$75 - $180',
          status: 'available',
          availableTickets: 650,
          totalTickets: 1200,
          genre: 'EDM'
        },
        {
          id: '5',
          name: 'Country Roads',
          artist: 'Nashville Stars',
          date: '2026-07-05',
          venue: 'Ryman Auditorium',
          image: 'https://picsum.photos/seed/country-roads/600/400',
          price: '$55 - $110',
          status: 'queue-active',
          availableTickets: 85,
          totalTickets: 600,
          genre: 'Country'
        },
        {
          id: '6',
          name: 'Hip Hop Showcase',
          artist: 'Urban Legends',
          date: '2026-09-15',
          venue: 'Brooklyn Arena',
          image: 'https://picsum.photos/seed/hip-hop/600/400',
          price: '$100 - $250',
          status: 'available',
          availableTickets: 320,
          totalTickets: 900,
          genre: 'Hip-Hop'
        }
      ];
      setConcerts(mockConcerts);
    };
    
    fetchConcerts();
  }, []);

  const handleJoinQueue = async (concertId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    try {
      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          concertId: concertId,
          userId: user.id
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Navigate to queue page with success message
        navigate(`/queue/${concertId}`, { 
          state: { 
            position: data.position,
            message: data.message 
          } 
        });
      } else {
        alert(data.message || 'Failed to join queue');
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      alert('Unable to join queue. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'available':
        return 'available';
      case 'queue-active':
        return 'queue-active';
      case 'sold-out':
        return 'sold-out';
      default:
        return 'available';
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'queue-active':
        return 'Queue Active';
      case 'sold-out':
        return 'Sold Out';
      default:
        return 'Available';
    }
  };

  // Get button text and action
  const getButtonConfig = (concert: Concert) => {
    switch (concert.status) {
      case 'available':
        return {
          text: 'Join Queue',
          className: 'join-queue-btn',
          disabled: false,
          action: () => handleJoinQueue(concert.id)
        };
      case 'queue-active':
        return {
          text: 'Join Active Queue',
          className: 'join-queue-btn active',
          disabled: false,
          action: () => handleJoinQueue(concert.id)
        };
      case 'sold-out':
        return {
          text: 'Sold Out',
          className: 'sold-out-btn',
          disabled: true,
          action: undefined
        };
      default:
        return {
          text: 'Join Queue',
          className: 'join-queue-btn',
          disabled: false,
          action: () => handleJoinQueue(concert.id)
        };
    }
  };

  if (loading) {
    return (
      <div className="home-page">
        <header className="home-header">
          <div className="header-content">
            <h1>ticketQ</h1>
          </div>
        </header>
        <main className="home-main">
          <div className="concerts-loading">Loading concerts</div>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-content">
          <h1>ticketQ</h1>
          <div className="user-info">
            {/* Show User Dashboard only for regular users */}
            {isUser && (
              <Link to="/dashboard" className="dashboard-link">
                📊 User Dashboard
              </Link>
            )}
            
            {/* Show Admin Dashboard only for admins */}
            {isAdmin && (
              <Link to="/admin" className="admin-link">
                ⚙️ Admin Dashboard
              </Link>
            )}
            
            {/* Show Premium Pass link only for regular users (not admins) */}
            {isUser && (
              <Link to="/purchase-pass" className="pass-link">
                ⭐ Get Premium Pass
              </Link>
            )}
            
            <button onClick={handleLogout} className="logout-btn">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <h1>
            <span>Welcome, {user?.name || 'Guest'}!</span>
          </h1>
          <p>Join the queue and secure tickets for your favorite artists</p>
          
          {/* Show role badge based on account type */}
          {isAdmin && (
            <div className="role-badge admin-badge">
              ⚡ Administrator Access - Full System Control
            </div>
          )}
          
          {isUser && user?.passStatus !== 'None' && user?.passStatus !== 'inactive' && (
            <div className="role-badge premium-badge">
              ⭐ Premium Member - Priority Queue Access
            </div>
          )}
          
          {isUser && (user?.passStatus === 'None' || user?.passStatus === 'inactive') && (
            <div className="role-badge standard-badge">
              🎫 Standard Member - <Link to="/purchase-pass" className="upgrade-link">Upgrade to Premium for Priority Access</Link>
            </div>
          )}
        </section>

        {error && (
          <div className="error-message" style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <section className="concerts-grid">
          <h3>Upcoming Concerts</h3>
          {concerts.length === 0 ? (
            <div className="concerts-empty">
              No concerts available at the moment. Check back soon!
            </div>
          ) : (
            <div className="concerts-list">
              {concerts.map((concert) => {
                const buttonConfig = getButtonConfig(concert);
                return (
                  <div key={concert.id} className="concert-card">
                    <div className="concert-image">
                      <img src={concert.image} alt={concert.name} />
                      <div className={`status-badge ${getStatusBadgeClass(concert.status)}`}>
                        {getStatusText(concert.status)}
                      </div>
                      {concert.genre && (
                        <div className="genre-badge" style={{
                          position: 'absolute',
                          bottom: '0.5rem',
                          left: '0.5rem',
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {concert.genre}
                        </div>
                      )}
                    </div>
                    
                    <div className="concert-info">
                      <h4>{concert.name}</h4>
                      <p className="artist">{concert.artist}</p>
                      <p className="venue">{concert.venue}</p>
                      <p className="date">{formatDate(concert.date)}</p>
                      <p className="price">{concert.price}</p>
                      
                      {concert.availableTickets !== undefined && concert.totalTickets !== undefined && (
                        <div className="ticket-info" style={{
                          marginTop: '0.5rem',
                          fontSize: '0.85rem',
                          color: '#6b7280'
                        }}>
                          <span>{concert.availableTickets} / {concert.totalTickets} tickets remaining</span>
                          {concert.availableTickets < 100 && concert.status !== 'sold-out' && (
                            <span style={{
                              display: 'inline-block',
                              marginLeft: '0.5rem',
                              color: '#f59e0b',
                              fontWeight: '600'
                            }}>
                              🔥 Almost sold out!
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="concert-actions">
                        <button 
                          onClick={buttonConfig.action}
                          disabled={buttonConfig.disabled}
                          className={buttonConfig.className}
                        >
                          {buttonConfig.text}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default HomePage;