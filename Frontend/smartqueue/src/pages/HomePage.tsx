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
}

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);

  useEffect(() => {
    // TODO: Replace with actual API call
    // Mock data for demonstration
    const mockConcerts: Concert[] = [
      {
        id: '1',
        name: 'Summer Music Festival',
        artist: 'Various Artists',
        date: '2026-07-15',
        venue: 'Central Park',
        image: '/concert1.jpg',
        price: '$85 - $150',
        status: 'available',
      },
      {
        id: '2',
        name: 'Rock Night',
        artist: 'The Electric Band',
        date: '2026-06-20',
        venue: 'Madison Square Garden',
        image: '/concert2.jpg',
        price: '$95 - $200',
        status: 'queue-active',
      },
      {
        id: '3',
        name: 'Jazz Evening',
        artist: 'Miles & Friends',
        date: '2026-05-30',
        venue: 'Blue Note',
        image: '/concert3.jpg',
        price: '$65 - $120',
        status: 'sold-out',
      },
    ];
    setConcerts(mockConcerts);
  }, []);

  const handleJoinQueue = (concertId: string) => {
    navigate(`/queue/${concertId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-content">
          <h1>SmartQueue</h1>
          <div className="user-info">
            <span>Welcome, {user?.name}!</span>
            <Link to="/dashboard" className="dashboard-link">Dashboard</Link>
            <Link to="/purchase-pass" className="pass-link">Get Premium Pass</Link>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <h2>Discover Amazing Concerts</h2>
          <p>Join the queue and secure your tickets for the hottest shows</p>
        </section>

        <section className="concerts-grid">
          <h3>Upcoming Concerts</h3>
          <div className="concerts-list">
            {concerts.map((concert) => (
              <div key={concert.id} className="concert-card">
                <div className="concert-image">
                  <img src={concert.image} alt={concert.name} />
                  <div className={`status-badge ${concert.status}`}>
                    {concert.status === 'available' && 'Available'}
                    {concert.status === 'queue-active' && 'Queue Active'}
                    {concert.status === 'sold-out' && 'Sold Out'}
                  </div>
                </div>
                
                <div className="concert-info">
                  <h4>{concert.name}</h4>
                  <p className="artist">{concert.artist}</p>
                  <p className="venue">{concert.venue}</p>
                  <p className="date">{new Date(concert.date).toLocaleDateString()}</p>
                  <p className="price">{concert.price}</p>
                  
                  <div className="concert-actions">
                    {concert.status === 'available' && (
                      <button 
                        onClick={() => handleJoinQueue(concert.id)}
                        className="join-queue-btn"
                      >
                        Join Queue
                      </button>
                    )}
                    {concert.status === 'queue-active' && (
                      <button 
                        onClick={() => handleJoinQueue(concert.id)}
                        className="join-queue-btn active"
                      >
                        Join Active Queue
                      </button>
                    )}
                    {concert.status === 'sold-out' && (
                      <button disabled className="sold-out-btn">
                        Sold Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;