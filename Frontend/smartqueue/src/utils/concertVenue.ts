export const VENUE_PRESETS = [
  'Central Stadium',
  'Downtown Theater',
  'Arena Center',
  'Madison Square Garden',
  'Blue Note',
] as const;

export const VENUE_OTHER = '__other__';
export const VENUE_MAX_LEN = 100;

export function venueSelectValue(venue: string): string {
  if (!venue.trim()) return '';
  if (VENUE_PRESETS.includes(venue as (typeof VENUE_PRESETS)[number])) return venue;
  return VENUE_OTHER;
}

export function venueOtherInputValue(venue: string): string {
  if (venueSelectValue(venue) !== VENUE_OTHER) return '';
  return venue === VENUE_OTHER ? '' : venue;
}

export function isVenuePreset(venue: string): boolean {
  return VENUE_PRESETS.includes(venue as (typeof VENUE_PRESETS)[number]);
}
