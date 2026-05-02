// src/components/ui/RecommendedConcerts.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RecommendationEngine from '../../utils/recommendationEngine';
import '../../styling/RecommendedConcerts.css';

// Match the Concert interface from HomePage
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
  recommendationScore?: number;
}

interface RecommendedConcertsProps {
  allConcerts: Concert[];
  onTrackInteraction?: (concert: Concert, action: string) => void;
}

const RecommendedConcerts: React.FC<RecommendedConcertsProps> = ({ allConcerts, onTrackInteraction }) => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [topGenres, setTopGenres] = useState<{ genre: string; count: number }[]>([]);

  useEffect(() => {
    if (isAuthenticated && user && !isAdmin && allConcerts.length > 0) {
      // Get recommendations - FIXED: removed the third parameter
      const recs = RecommendationEngine.getRecommendations(
        user.id,
        allConcerts
      );
      setRecommendations(recs);
      
      // Get user's top genres for personalization
      const genres = RecommendationEngine.getUserTopGenres(user.id);
      setTopGenres(genres);
      
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, isAuthenticated, allConcerts, isAdmin]);

  const handleInteraction = (concert: Concert, action: 'view' | 'queue_join') => {
    if (user) {
      RecommendationEngine.trackInteraction(user.id, concert, action);
      if (onTrackInteraction) {
        onTrackInteraction(concert, action);
      }
      
      if (action === 'queue_join') {
        navigate(`/queue/${concert.id}`);
      }
    } else {
      navigate('/login');
    }
  };

  // Don't show for non-authenticated users or admins
  if (!isAuthenticated || isAdmin || loading || recommendations.length === 0) {
    return null;
  }

  // Get personalized greeting
  const getPersonalizedGreeting = () => {
    if (topGenres.length > 0) {
      return `Based on your interest in ${topGenres[0].genre}`;
    }
    return `Recommended just for you`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="recommended-section">
      <div className="recommended-header">
        <div>
          <h2>🎯 Recommended Events For You</h2>
          <p className="recommended-subtitle">{getPersonalizedGreeting()}</p>
        </div>
      </div>

      <div className="recommended-grid">
        {recommendations.map((concert) => (
          <div 
            key={concert.id} 
            className="recommended-card"
            onMouseEnter={() => handleInteraction(concert, 'view')}
          >
            <div className="rec-card-image">
              <img src={concert.image} alt={concert.name} />
              {concert.recommendationScore && concert.recommendationScore > 70 && (
                <div className="match-badge">
                  {Math.round(concert.recommendationScore)}% match
                </div>
              )}
              {concert.status === 'available' && concert.availableTickets && concert.availableTickets < 100 && (
                <div className="urgent-badge">
                  🔥 Only {concert.availableTickets} left!
                </div>
              )}
            </div>
            
            <div className="rec-card-content">
              <h3>{concert.name}</h3>
              <p className="rec-artist">{concert.artist}</p>
              <p className="rec-venue">{concert.venue}</p>
              
              {concert.genre && (
                <div className="rec-genre">
                  <span className="genre-tag">{concert.genre}</span>
                </div>
              )}
              
              <div className="rec-card-footer">
                <div className="rec-price-info">
                  <span className="rec-price">{concert.price}</span>
                  <span className="rec-date">{formatDate(concert.date)}</span>
                </div>
                <button
                  onClick={() => handleInteraction(concert, 'queue_join')}
                  className={`rec-join-btn ${concert.status === 'available' ? 'available' : ''}`}
                  disabled={concert.status === 'sold-out'}
                >
                  {concert.status === 'available' ? 'Get Tickets' : 
                   concert.status === 'queue-active' ? 'Join Queue' : 
                   'Sold Out'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {recommendations.length === 0 && !loading && (
        <div className="no-recommendations">
          <p>Explore concerts to get personalized recommendations! 🎵</p>
        </div>
      )}
    </div>
  );
};

export default RecommendedConcerts;