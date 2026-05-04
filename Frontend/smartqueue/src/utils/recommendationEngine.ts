// src/utils/recommendationEngine.ts

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

export interface UserInteraction {
  concertId: string;
  action: 'view' | 'queue_join' | 'purchase';
  timestamp: string;
  artist: string;
  genre?: string;
}

class RecommendationEngine {
  private static readonly STORAGE_KEY_PREFIX = 'ticketq_behavior_';
  
  static trackInteraction(userId: string, concert: Concert, action: 'view' | 'queue_join' | 'purchase') {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const storage = localStorage.getItem(storageKey);
      const interactions: UserInteraction[] = storage ? JSON.parse(storage) : [];
      
      // Check for duplicate within last 5 seconds
      const now = new Date();
      const isDuplicate = interactions.some(i => 
        i.concertId === concert.id && 
        i.action === action &&
        (now.getTime() - new Date(i.timestamp).getTime()) < 5000
      );
      
      if (!isDuplicate) {
        interactions.push({
          concertId: concert.id,
          action,
          timestamp: now.toISOString(),
          artist: concert.artist,
          genre: concert.genre || 'Unknown',
        });
        
        const trimmed = interactions.slice(-50);
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
        console.log(`✅ Tracked ${action} for ${concert.name} (${concert.genre})`);
      }
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }
  
  static getRecommendations(userId: string, allConcerts: Concert[]): Concert[] {
    const now = new Date();
    const futureConcerts = allConcerts.filter(concert => {
      const concertDate = new Date(concert.date);
      return concertDate > now;
    });
    
    if (futureConcerts.length === 0) return [];
    
    const interactions = this.getUserInteractions(userId);
    
    // Only count queue_join and purchase for genre preference
    const meaningfulInteractions = interactions.filter(i => 
      i.action === 'queue_join' || i.action === 'purchase'
    );
    
    console.log(`Total interactions: ${interactions.length}, Meaningful: ${meaningfulInteractions.length}`);
    
    // Get user's preferred genres from MEANINGFUL interactions only
    const genreCounts: Record<string, number> = {};
    meaningfulInteractions.forEach(i => {
      if (i.genre && i.genre !== 'Unknown') {
        const weight = i.action === 'purchase' ? 3 : 1;
        genreCounts[i.genre] = (genreCounts[i.genre] || 0) + weight;
      }
    });
    
    const preferredGenres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]);
    console.log('Preferred genres (from purchases/queues):', preferredGenres);
    console.log('Genre weights:', genreCounts);
    
    // If user has meaningful interactions, use those genres
    if (preferredGenres.length > 0) {
      const filteredByGenre = futureConcerts.filter(concert => 
        preferredGenres.includes(concert.genre || '')
      );
      
      if (filteredByGenre.length > 0) {
        // FIX: Sort by weight (higher first) THEN by date
        const sorted = filteredByGenre.sort((a, b) => {
          // Get weight for each concert's genre
          const weightA = genreCounts[a.genre || ''] || 0;
          const weightB = genreCounts[b.genre || ''] || 0;
          
          // If weights are different, higher weight comes first
          if (weightA !== weightB) {
            return weightB - weightA;
          }
          
          // If same weight, sort by date (soonest first)
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        
        const recommendations = sorted.slice(0, 6);
        console.log('Recommendations (sorted by weight then date):', recommendations.map(c => `${c.name} (${c.genre})`));
        return recommendations;
      }
    }
    
    // If no meaningful interactions, show diverse defaults
    console.log('No meaningful interactions - showing diverse defaults');
    return this.getDiverseDefaultRecommendations(futureConcerts);
  }
  
  private static getDiverseDefaultRecommendations(futureConcerts: Concert[]): Concert[] {
    // Group by genre
    const byGenre: Record<string, Concert[]> = {};
    for (const concert of futureConcerts) {
      const genre = concert.genre || 'Other';
      if (!byGenre[genre]) byGenre[genre] = [];
      byGenre[genre].push(concert);
    }
    
    const result: Concert[] = [];
    const genres = Object.keys(byGenre);
    
    // Sort each genre's concerts by date
    for (const genre of genres) {
      byGenre[genre].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    // Take the soonest concert from each genre
    for (const genre of genres) {
      if (result.length >= 6) break;
      if (byGenre[genre].length > 0) {
        result.push(byGenre[genre][0]);
      }
    }
    
    return result.slice(0, 6);
  }
  
  private static getUserInteractions(userId: string): UserInteraction[] {
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const storage = localStorage.getItem(storageKey);
      return storage ? JSON.parse(storage) : [];
    } catch (error) {
      return [];
    }
  }
  
  static getUserTopGenres(userId: string): { genre: string; count: number }[] {
    const interactions = this.getUserInteractions(userId);
    const genreCount: Record<string, number> = {};
    
    // Only count meaningful interactions (queue_join and purchase)
    interactions.forEach(interaction => {
      if (interaction.genre && interaction.genre !== 'Unknown') {
        if (interaction.action === 'queue_join' || interaction.action === 'purchase') {
          const weight = interaction.action === 'purchase' ? 3 : 1;
          genreCount[interaction.genre] = (genreCount[interaction.genre] || 0) + weight;
        }
      }
    });
    
    return Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }
}

export default RecommendationEngine;