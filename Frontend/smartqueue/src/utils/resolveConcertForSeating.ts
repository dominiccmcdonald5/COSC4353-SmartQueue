import { ADMIN_EVENTS_STORAGE_KEY } from '../data/adminEventsStorage';
import type { ConcertEvent } from '../types/concertEvent';

/** When an event id is not in admin storage, use same ids as HomePage / queue flows. */
const FALLBACK_CONCERTS: Record<
  string,
  { name: string; artist: string; date: string; venue: string; ticketPriceMin: number; ticketPriceMax: number }
> = {
  '1': {
    name: 'Summer Music Festival',
    artist: 'Various Artists',
    date: '2026-07-15',
    venue: 'Central Park',
    ticketPriceMin: 85,
    ticketPriceMax: 150,
  },
  '2': {
    name: 'Rock Night',
    artist: 'The Electric Band',
    date: '2026-06-20',
    venue: 'Madison Square Garden',
    ticketPriceMin: 95,
    ticketPriceMax: 200,
  },
  '3': {
    name: 'Jazz Evening',
    artist: 'Miles & Friends',
    date: '2026-05-30',
    venue: 'Blue Note',
    ticketPriceMin: 65,
    ticketPriceMax: 120,
  },
};

export interface ResolvedConcertSeating {
  name: string;
  artist: string;
  date: string;
  venue: string;
  ticketPriceMin: number;
  ticketPriceMax: number;
}

function normalizeMinMax(min: number, max: number): { min: number; max: number } {
  let a = Number(min) || 0;
  let b = Number(max) || 0;
  if (a > b) [a, b] = [b, a];
  if (a === 0 && b === 0) {
    return { min: 25, max: 100 };
  }
  return { min: a, max: b };
}

/**
 * Pricing comes from admin-saved concert events (`ticketPriceMin` / `ticketPriceMax`),
 * i.e. the ticket “service” price band for that show — not the backend service-management API.
 */
export function resolveConcertForSeating(concertId: string | undefined): ResolvedConcertSeating | null {
  if (!concertId) return null;

  try {
    const raw = localStorage.getItem(ADMIN_EVENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const e = parsed.find(
          (item): item is ConcertEvent =>
            !!item && typeof item === 'object' && String((item as ConcertEvent).id) === concertId,
        );
        if (e?.name) {
          const { min, max } = normalizeMinMax(e.ticketPriceMin, e.ticketPriceMax);
          return {
            name: e.name,
            artist: e.artist ?? '',
            date: e.date ?? '',
            venue: e.venue ?? '',
            ticketPriceMin: min,
            ticketPriceMax: max,
          };
        }
      }
    }
  } catch {
    /* ignore */
  }

  const fb = FALLBACK_CONCERTS[concertId];
  if (!fb) return null;
  const { min, max } = normalizeMinMax(fb.ticketPriceMin, fb.ticketPriceMax);
  return { ...fb, ticketPriceMin: min, ticketPriceMax: max };
}
