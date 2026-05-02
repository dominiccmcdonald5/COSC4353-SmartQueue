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
    allConcerts: Concert[]
  ): Concert[] {
    // 1. Filter to ONLY future concerts (past concerts shouldn't be recommended)
    const now = new Date();
    const futureConcerts = allConcerts.filter(concert => {
      const concertDate = new Date(concert.date);
      return concertDate > now;
    });
    
    if (futureConcerts.length === 0) return [];
    
    // Get user's interaction history
    const interactions = this.getUserInteractions(userId);
    
    if (interactions.length === 0) {
      // New user - show upcoming available concerts
      return this.getDefaultRecommendations(futureConcerts);
    }
    
    // Calculate scores for each future concert
    const scoredConcerts = futureConcerts.map(concert => {
      let score = 0;
      
      // Factor 1: Genre preference (60% weight - most important)
      const genreScore = this.calculateGenreScore(interactions, concert);
      score += genreScore * 0.6;
      
      // Factor 2: Artist affinity (30% weight)
      const artistScore = this.calculateArtistScore(interactions, concert);
      score += artistScore * 0.3;
      
      // Factor 3: Availability/urgency (10% weight - tiebreaker)
      const availabilityScore = this.calculateAvailabilityScore(concert);
      score += availabilityScore * 0.1;
      
      // Only penalize if user already committed to THIS concert (joined queue or purchased)
      const alreadyCommitted = interactions.some(i => 
        i.concertId === concert.id && 
        (i.action === 'queue_join' || i.action === 'purchase')
      );
      
      if (alreadyCommitted) {
        score *= 0.2; // Drastically reduce but don't eliminate (in case they want more tickets)
      }
      
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
    
    // Weight by action type (purchase > queue_join > view)
    const weightedScore = genreInteractions.reduce((sum, interaction) => {
      const actionWeight = interaction.action === 'purchase' ? 3 : 
                          interaction.action === 'queue_join' ? 2 : 1;
      return sum + actionWeight;
    }, 0);
    
    // Normalize to 0-100 (max 100 for 10+ interactions)
    return Math.min(100, weightedScore * 10);
  }
  
  private static calculateArtistScore(interactions: UserInteraction[], concert: Concert): number {
    const artistInteractions = interactions.filter(i => i.artist === concert.artist);
    if (artistInteractions.length === 0) return 0;
    
    const weightedScore = artistInteractions.reduce((sum, interaction) => {
      const actionWeight = interaction.action === 'purchase' ? 3 : 
                          interaction.action === 'queue_join' ? 2 : 1;
      return sum + actionWeight;
    }, 0);
    
    return Math.min(100, weightedScore * 20);
  }
  
  private static calculateAvailabilityScore(concert: Concert): number {
    let score = 50; // Base score
    
    // Better availability = higher score
    if (concert.status === 'available') {
      score += 30;
    } else if (concert.status === 'queue-active') {
      score += 15;
    } else if (concert.status === 'sold-out') {
      score -= 40;
    }
    
    // Urgency (low tickets = higher score due to FOMO - Fear Of Missing Out)
    if (concert.availableTickets && concert.availableTickets < 50) {
      score += 20;
    } else if (concert.availableTickets && concert.availableTickets < 100) {
      score += 10;
    }
    
    // Concerts happening sooner get a small boost
    const concertDate = new Date(concert.date);
    const daysUntil = Math.ceil((concertDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 7) {
      score += 10; // Bonus for concerts this week
    } else if (daysUntil > 7 && daysUntil <= 30) {
      score += 5; // Small bonus for concerts this month
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  private static getDefaultRecommendations(futureConcerts: Concert[]): Concert[] {
    // For new users: show available concerts coming up soon
    const sorted = [...futureConcerts].sort((a, b) => {
      // Available concerts first
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (a.status !== 'available' && b.status === 'available') return 1;
      
      // Then by date (soonest first)
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
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