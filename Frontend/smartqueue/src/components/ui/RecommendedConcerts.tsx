// src/components/ui/RecommendedConcerts.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  const [startIndex, setStartIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Number of cards to show based on screen size
  const getCardsToShow = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) return 1;
      if (window.innerWidth < 1024) return 2;
    }
    return 3; // Desktop shows 3 cards
  };
  
  const [cardsToShow, setCardsToShow] = useState(getCardsToShow());

  useEffect(() => {
    const handleResize = () => {
      setCardsToShow(getCardsToShow());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && !isAdmin && allConcerts.length > 0) {
      // Get recommendations
      const recs = RecommendationEngine.getRecommendations(
        user.id,
        allConcerts
      );
      setRecommendations(recs);
      
      // Get user's top genres for personalization
      const genres = RecommendationEngine.getUserTopGenres(user.id);
      setTopGenres(genres);
      
      setLoading(false);
      setStartIndex(0); // Reset to first slide when recommendations change
    } else {
      setLoading(false);
    }
  }, [user, isAuthenticated, allConcerts, isAdmin]);

  // Auto-play logic (very slow - 8 seconds per slide)
  useEffect(() => {
    const maxStartIndex = Math.max(0, recommendations.length - cardsToShow);
    
    if (isAutoPlaying && recommendations.length > cardsToShow && maxStartIndex > 0) {
      autoPlayIntervalRef.current = setInterval(() => {
        setStartIndex((prevIndex) => {
          const maxIndex = Math.max(0, recommendations.length - cardsToShow);
          return prevIndex + 1 > maxIndex ? 0 : prevIndex + 1;
        });
      }, 8000); // 8 seconds per slide - very slow
    }

    return () => {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current);
      }
    };
  }, [isAutoPlaying, recommendations.length, cardsToShow]);

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

  const handleNext = () => {
    setIsAutoPlaying(false);
    const maxStartIndex = Math.max(0, recommendations.length - cardsToShow);
    setStartIndex((prev) => Math.min(prev + 1, maxStartIndex));
  };

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setStartIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setStartIndex(index);
  };

  const handleResumeAutoPlay = () => {
    setIsAutoPlaying(true);
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

  const visibleConcerts = recommendations.slice(startIndex, startIndex + cardsToShow);
  const maxStartIndex = Math.max(0, recommendations.length - cardsToShow);
  const totalSlides = maxStartIndex + 1;

  return (
    <div className="recommended-section">
      <div className="recommended-header">
        <div>
          <h2>Recommended Events For You</h2>
          <p className="recommended-subtitle">{getPersonalizedGreeting()}</p>
        </div>
        <div className="header-actions">
          {!isAutoPlaying && recommendations.length > cardsToShow && (
            <button onClick={handleResumeAutoPlay} className="resume-auto-btn" title="Resume auto-play">
              Resume Auto
            </button>
          )}
        </div>
      </div>

      <div className="carousel-container">
        {recommendations.length > cardsToShow && startIndex > 0 && (
          <button onClick={handlePrev} className="carousel-nav prev" aria-label="Previous">
            ‹
          </button>
        )}

        <div className="carousel-track">
          <div className="recommended-grid" style={{ gridTemplateColumns: `repeat(${cardsToShow}, 1fr)` }}>
            {visibleConcerts.map((concert) => (
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
        </div>

        {recommendations.length > cardsToShow && startIndex < maxStartIndex && (
          <button onClick={handleNext} className="carousel-nav next" aria-label="Next">
            ›
          </button>
        )}
      </div>

      {recommendations.length > cardsToShow && (
        <div className="carousel-dots">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === startIndex ? 'active' : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      <div className="carousel-info">
        <span className="slide-counter">
          Showing {startIndex + 1}-{Math.min(startIndex + cardsToShow, recommendations.length)} of {recommendations.length}
        </span>
        {isAutoPlaying && recommendations.length > cardsToShow && (
          <span className="auto-playing">▶ Auto-playing (8s)</span>
        )}
        {!isAutoPlaying && recommendations.length > cardsToShow && (
          <span className="auto-play-stopped">⏸ Paused</span>
        )}
      </div>
    </div>
  );
};

export default RecommendedConcerts;