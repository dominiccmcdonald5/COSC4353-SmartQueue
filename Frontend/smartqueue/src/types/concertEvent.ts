/** Max characters for artist name in admin concert forms. */
export const CONCERT_ARTIST_MAX_LEN = 50;

export interface ConcertEvent {
  id: string;
  name: string;
  artist: string;
  genre: string;
  date: string;
  venue: string;
  image: string;
  capacity: number;
  ticketPriceMin: number;
  ticketPriceMax: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  published: boolean;
}
