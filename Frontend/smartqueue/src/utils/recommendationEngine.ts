// src/utils/recommendationEngine.ts

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
}

interface UserInteraction {
  concertId: string;
  action: 'view' | 'queue_join' | 'purchase';
  timestamp: string;
  artist: string;
  genre?: string;
}

class RecommendationEngine {
  private static readonly STORAGE_KEY_PREFIX = 'ticketq_behavior_';
  
  // Track user interaction with concerts
  static trackInteraction(userId: string, concert: Concert, action: 'view' | 'queue_join' | 'purchase') {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const storage = localStorage.getItem(storageKey);
      const interactions: UserInteraction[] = storage ? JSON.parse(storage) : [];
      
      interactions.push({
        concertId: concert.id,
        action,
        timestamp: new Date().toISOString(),
        artist: concert.artist,
        genre: concert.genre
      });
      
      // Keep last 50 interactions
      const trimmed = interactions.slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
      
      console.log(`Tracked ${action} for user ${userId} on concert ${concert.name}`);
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }
  
  // Get personalized recommendations
  static getRecommendations(
    userId: string, 
    allConcerts: Concert[], 
    userPassStatus: string
  ): Concert[] {
    // Get user's interaction history
    const interactions = this.getUserInteractions(userId);
    
    if (interactions.length === 0) {
      // New user - show popular/upcoming concerts
      return this.getDefaultRecommendations(allConcerts, userPassStatus);
    }
    
    // Calculate scores for each concert
    const scoredConcerts = allConcerts.map(concert => {
      let score = 0;
      
      // Factor 1: Genre preference (40% weight)
      const genreScore = this.calculateGenreScore(interactions, concert);
      score += genreScore * 0.4;
      
      // Factor 2: Artist affinity (30% weight)
      const artistScore = this.calculateArtistScore(interactions, concert);
      score += artistScore * 0.3;
      
      // Factor 3: Recency & availability (20% weight)
      const availabilityScore = this.calculateAvailabilityScore(concert);
      score += availabilityScore * 0.2;
      
      // Factor 4: Pass status bonus (10% weight)
      const passBonus = userPassStatus === 'Gold' ? 20 : (userPassStatus === 'Silver' ? 10 : 0);
      score += passBonus * 0.1;
      
      // Factor 5: Exclude already interacted concerts
      const hasInteracted = interactions.some(i => i.concertId === concert.id);
      if (hasInteracted) score *= 0.3; // Reduce score but don't eliminate completely
      
      return { ...concert, recommendationScore: score };
    });
    
    // Sort by score and return top 5
    return scoredConcerts
      .sort((a, b) => (b as any).recommendationScore - (a as any).recommendationScore)
      .slice(0, 5);
  }
  
  private static getUserInteractions(userId: string): UserInteraction[] {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const storage = localStorage.getItem(storageKey);
      return storage ? JSON.parse(storage) : [];
    } catch (error) {
      console.error('Failed to get user interactions:', error);
      return [];
    }
  }
  
  private static calculateGenreScore(interactions: UserInteraction[], concert: Concert): number {
    if (!concert.genre) return 0;
    
    const genreInteractions = interactions.filter(i => i.genre === concert.genre);
    if (genreInteractions.length === 0) return 0;
    
    // Weight more recent interactions higher
    const now = new Date();
    const weightedScore = genreInteractions.reduce((sum, interaction) => {
      const daysAgo = (now.getTime() - new Date(interaction.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0, 1 - daysAgo / 30); // Decay over 30 days
      const actionWeight = interaction.action === 'purchase' ? 3 : 
                          interaction.action === 'queue_join' ? 2 : 1;
      return sum + (recencyWeight * actionWeight);
    }, 0);
    
    return Math.min(100, weightedScore * 20);
  }
  
  private static calculateArtistScore(interactions: UserInteraction[], concert: Concert): number {
    const artistInteractions = interactions.filter(i => i.artist === concert.artist);
    if (artistInteractions.length === 0) return 0;
    
    const weightedScore = artistInteractions.reduce((sum, interaction) => {
      const actionWeight = interaction.action === 'purchase' ? 3 : 
                          interaction.action === 'queue_join' ? 2 : 1;
      return sum + actionWeight;
    }, 0);
    
    return Math.min(100, weightedScore * 25);
  }
  
  private static calculateAvailabilityScore(concert: Concert): number {
    let score = 0;
    
    // Upcoming concerts (within 30 days) get higher score
    const concertDate = new Date(concert.date);
    const daysUntil = Math.ceil((concertDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 0 && daysUntil <= 30) {
      score += 40;
    } else if (daysUntil > 30 && daysUntil <= 60) {
      score += 20;
    }
    
    // Availability status
    if (concert.status === 'available') {
      score += 40;
    } else if (concert.status === 'queue-active') {
      score += 20;
    }
    
    // Low ticket count creates urgency
    if (concert.availableTickets && concert.availableTickets < 100) {
      score += 20;
    }
    
    return score;
  }
  
  private static getDefaultRecommendations(allConcerts: Concert[], userPassStatus: string): Concert[] {
    // Get upcoming concerts (within next 60 days)
    const now = new Date();
    const upcomingConcerts = allConcerts.filter(concert => {
      const concertDate = new Date(concert.date);
      const daysUntil = Math.ceil((concertDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 60;
    });
    
    const sorted = [...upcomingConcerts].sort((a, b) => {
      // Prioritize available concerts
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;
      
      // Then by date (soonest first)
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    // If Gold or Silver user, show higher price range concerts
    if (userPassStatus === 'Gold' || userPassStatus === 'Silver') {
      const higherPriced = sorted.filter(c => {
        const priceNum = parseInt(c.price.replace('$', ''));
        return !isNaN(priceNum) && priceNum > 75;
      });
      if (higherPriced.length >= 3) return higherPriced.slice(0, 5);
    }
    
    return sorted.slice(0, 5);
  }
  
  // Analytics: Get user's top genres
  static getUserTopGenres(userId: string): { genre: string; count: number }[] {
    const interactions = this.getUserInteractions(userId);
    const genreCount: Record<string, number> = {};
    
    interactions.forEach(interaction => {
      if (interaction.genre) {
        genreCount[interaction.genre] = (genreCount[interaction.genre] || 0) + 1;
      }
    });
    
    return Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }
}

export default RecommendationEngine;