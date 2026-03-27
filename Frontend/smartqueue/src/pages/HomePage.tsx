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

// Skeleton Loader Component
const ConcertSkeleton: React.FC = () => (
  <div className="concert-card skeleton">
    <div className="concert-image skeleton-image"></div>
    <div className="concert-info">
      <div className="skeleton-title"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-text short"></div>
      <div className="skeleton-button"></div>
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const { user, logout, isAdmin, isUser } = useAuth();
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'price'>('date');
  const [genres, setGenres] = useState<string[]>([]);
  
  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorite_concerts');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage when updated
  useEffect(() => {
    localStorage.setItem('favorite_concerts', JSON.stringify(favorites));
  }, [favorites]);

  // Extract unique genres from concerts
  useEffect(() => {
    if (concerts.length > 0) {
      const uniqueGenres = [...new Set(concerts.map(c => c.genre).filter(Boolean))];
      setGenres(uniqueGenres as string[]);
    }
  }, [concerts]);

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
        loadMockData();
      }
    } catch (error) {
      console.error('Error fetching concerts:', error);
      setError('Unable to connect to server. Showing demo data.');
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

  useEffect(() => {
    fetchConcerts();
  }, []);

  // Helper function to check if concert is coming soon
  const isComingSoon = (dateString: string) => {
    const concertDate = new Date(dateString);
    const now = new Date();
    const daysUntil = Math.ceil((concertDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil > 30 && daysUntil <= 60;
  };

  // Toggle favorite
  const toggleFavorite = (concertId: string) => {
    setFavorites(prev => 
      prev.includes(concertId) 
        ? prev.filter(id => id !== concertId)
        : [...prev, concertId]
    );
  };

  // Filter and sort concerts
  const getFilteredAndSortedConcerts = () => {
    let filtered = concerts.filter(concert => {
      const matchesSearch = concert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            concert.artist.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenre = selectedGenre === 'all' || concert.genre === selectedGenre;
      const matchesStatus = selectedStatus === 'all' || concert.status === selectedStatus;
      return matchesSearch && matchesGenre && matchesStatus;
    });
    
    // Apply sorting
    switch (sortBy) {
      case 'date':
        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'name':
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case 'price':
        return filtered.sort((a, b) => {
          const priceA = parseInt(a.price.split(' - ')[0].replace('$', ''));
          const priceB = parseInt(b.price.split(' - ')[0].replace('$', ''));
          return priceA - priceB;
        });
      default:
        return filtered;
    }
  };

  const filteredConcerts = getFilteredAndSortedConcerts();

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

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

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

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedGenre('all');
    setSelectedStatus('all');
    setSortBy('date');
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
          <div className="concerts-grid">
            <h3>Upcoming Concerts</h3>
            <div className="concerts-list">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <ConcertSkeleton key={i} />
              ))}
            </div>
          </div>
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
            {isUser && (
              <Link to="/dashboard" className="dashboard-link">
                📊 User Dashboard
              </Link>
            )}
            
            {isAdmin && (
              <Link to="/admin" className="admin-link">
                ⚙️ Admin Dashboard
              </Link>
            )}
            
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
          
          {/* Show premium badge for Gold or Silver members */}
          {isUser && (user?.passStatus === 'Gold' || user?.passStatus === 'Silver') && (
            <div className="role-badge premium-badge">
              ⭐ Premium Member - Priority Queue Access
            </div>
          )}
          
          {/* Show standard badge for users with no premium pass */}
          {isUser && user?.passStatus === 'None' && (
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

        {/* Search and Filter Section */}
        <div className="filters-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by concert or artist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <div className="filter-controls">
            <select 
              value={selectedGenre} 
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Genres</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="queue-active">Queue Active</option>
              <option value="sold-out">Sold Out</option>
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'price')}
              className="filter-select"
            >
              <option value="date">Sort by: Date (Soonest first)</option>
              <option value="name">Sort by: Name (A-Z)</option>
              <option value="price">Sort by: Price (Lowest first)</option>
            </select>
            
            <button 
              onClick={clearFilters}
              className="clear-filters-btn"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="results-count">
            Found {filteredConcerts.length} concert{filteredConcerts.length !== 1 ? 's' : ''}
          </div>
        </div>

        <section className="concerts-grid">
          <h3>Upcoming Concerts</h3>
          {filteredConcerts.length === 0 ? (
            <div className="concerts-empty">
              No concerts match your filters. Try adjusting your search criteria!
            </div>
          ) : (
            <div className="concerts-list">
              {filteredConcerts.map((concert) => {
                const buttonConfig = getButtonConfig(concert);
                return (
                  <div key={concert.id} className="concert-card">
                    <div className="concert-image">
                      <img src={concert.image} alt={concert.name} />
                      <div className={`status-badge ${getStatusBadgeClass(concert.status)}`}>
                        {getStatusText(concert.status)}
                      </div>
                      
                      {isComingSoon(concert.date) && (
                        <div className="coming-soon-badge">
                          🎵 Coming Soon
                        </div>
                      )}
                      
                      {concert.genre && (
                        <div className="genre-badge">
                          {concert.genre}
                        </div>
                      )}
                      
                      <button 
                        onClick={() => toggleFavorite(concert.id)}
                        className={`favorite-btn ${favorites.includes(concert.id) ? 'active' : ''}`}
                      >
                        {favorites.includes(concert.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    
                    <div className="concert-info">
                      <h4>{concert.name}</h4>
                      <p className="artist">{concert.artist}</p>
                      <p className="venue">{concert.venue}</p>
                      <p className="date">{formatDate(concert.date)}</p>
                      <p className="price">{concert.price}</p>
                      
                      {concert.availableTickets !== undefined && concert.totalTickets !== undefined && (
                        <div className="ticket-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{
                                width: `${(concert.availableTickets / concert.totalTickets) * 100}%`,
                                background: concert.availableTickets < 100 ? '#f59e0b' : '#10b981'
                              }}
                            ></div>
                          </div>
                          <div className="ticket-stats">
                            <span>{concert.availableTickets} tickets left</span>
                            <span>{Math.round((concert.availableTickets / concert.totalTickets) * 100)}% available</span>
                          </div>
                          {concert.availableTickets < 100 && concert.status !== 'sold-out' && (
                            <div className="low-ticket-warning">
                              🔥 Almost sold out!
                            </div>
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