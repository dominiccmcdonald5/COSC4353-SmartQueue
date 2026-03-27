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
