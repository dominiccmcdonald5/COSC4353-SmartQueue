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
      
      console.log(`Tracked ${action} for user ${userId} on concert ${concert.name} (Genre: ${concert.genre})`);
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }
  
  // Get personalized recommendations
  static getRecommendations(
    userId: string, 
    allConcerts: Concert[]
  ): Concert[] {
    // 1. Filter to ONLY future concerts
    const now = new Date();
    const futureConcerts = allConcerts.filter(concert => {
      const concertDate = new Date(concert.date);
      return concertDate > now;
    });
    
    if (futureConcerts.length === 0) return [];
    
    // Get user's interaction history
    const interactions = this.getUserInteractions(userId);
    
    // Debug: Log user's genre history
    const userGenres = [...new Set(interactions.map(i => i.genre).filter(Boolean))];
    console.log(`User ${userId} has interacted with genres:`, userGenres);
    
    if (interactions.length === 0) {
      console.log('New user - showing default recommendations');
      return this.getDefaultRecommendations(futureConcerts);
    }
    
    // Calculate scores for each future concert
    const scoredConcerts = futureConcerts.map(concert => {
      let score = 0;
      let breakdown = {} as any;
      
      // Factor 1: Genre preference (70% weight - increased from 60%)
      const genreScore = this.calculateGenreScore(interactions, concert);
      const genreContribution = genreScore * 0.7;
      score += genreContribution;
      breakdown.genre = { score: genreScore, contribution: genreContribution };
      
      // Factor 2: Artist affinity (20% weight)
      const artistScore = this.calculateArtistScore(interactions, concert);
      const artistContribution = artistScore * 0.2;
      score += artistContribution;
      breakdown.artist = { score: artistScore, contribution: artistContribution };
      
      // Factor 3: Availability/urgency (10% weight - tiebreaker)
      const availabilityScore = this.calculateAvailabilityScore(concert);
      const availabilityContribution = availabilityScore * 0.1;
      score += availabilityContribution;
      breakdown.availability = { score: availabilityScore, contribution: availabilityContribution };
      
      // Only penalize if user already committed to THIS concert
      const alreadyCommitted = interactions.some(i => 
        i.concertId === concert.id && 
        (i.action === 'queue_join' || i.action === 'purchase')
      );
      
      if (alreadyCommitted) {
        score *= 0.2;
        breakdown.penalty = 'Applied 80% penalty (already committed)';
      }
      
      // Debug logging for EDM issue
      if (concert.genre === 'EDM' || concert.genre === 'Electronic') {
        console.log(`Concert "${concert.name}" (${concert.genre}) - Genre Score: ${genreScore}, Total: ${score}`);
      }
      
      return { ...concert, recommendationScore: score, scoreBreakdown: breakdown };
    });
    
    // Sort by score and return top recommendations (show up to 6 for carousel)
    const sorted = scoredConcerts
      .sort((a, b) => (b as any).recommendationScore - (a as any).recommendationScore)
      .slice(0, 6);
    
    // Debug: Log top recommendations
    console.log('Top recommendations:', sorted.map(c => ({ 
      name: c.name, 
      genre: c.genre, 
      score: (c as any).recommendationScore 
    })));
    
    return sorted;
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
    // If concert has no genre, give 0 score
    if (!concert.genre) return 0;
    
    // Get all interactions for this specific genre
    const genreInteractions = interactions.filter(i => i.genre === concert.genre);
    
    // CRITICAL FIX: If user has NEVER interacted with this genre, score should be 0
    if (genreInteractions.length === 0) {
      return 0;
    }
    
    // Calculate weighted score based on action types
    const weightedScore = genreInteractions.reduce((sum, interaction) => {
      const actionWeight = interaction.action === 'purchase' ? 3 : 
                          interaction.action === 'queue_join' ? 2 : 1;
      return sum + actionWeight;
    }, 0);
    
    // Normalize to 0-100 (max 100 for 10+ weighted interactions)
    // A single view gives ~10 points, a single queue gives ~20, a single purchase gives ~30
    const normalizedScore = Math.min(100, weightedScore * 10);
    
    return normalizedScore;
  }
  
  private static calculateArtistScore(interactions: UserInteraction[], concert: Concert): number {
    const artistInteractions = interactions.filter(i => i.artist === concert.artist);
    
    // If user has never interacted with this artist, score should be 0
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
    
    // Urgency (low tickets = higher score due to FOMO)
    if (concert.availableTickets && concert.availableTickets < 50) {
      score += 20;
    } else if (concert.availableTickets && concert.availableTickets < 100) {
      score += 10;
    }
    
    // Concerts happening sooner get a small boost
    const concertDate = new Date(concert.date);
    const daysUntil = Math.ceil((concertDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 7) {
      score += 10;
    } else if (daysUntil > 7 && daysUntil <= 30) {
      score += 5;
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
    
    return sorted.slice(0, 6);
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
  
  // Debug method to clear user history (for testing)
  static clearUserHistory(userId: string): void {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(storageKey);
      console.log(`Cleared history for user ${userId}`);
    } catch (error) {
      console.error('Failed to clear user history:', error);
    }
  }
}

export default RecommendationEngine;