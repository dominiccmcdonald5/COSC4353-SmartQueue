const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Concert/event dates from the API are calendar dates (YYYY-MM-DD).
 * `new Date('2026-01-01')` is parsed as UTC midnight, so `toLocaleDateString()`
 * can show the previous day in US timezones. Parse as local calendar date instead.
 */
export function parseLocalDateFromApi(value: string | undefined | null): Date | null {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  const m = DATE_ONLY.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

export function formatLocalDateFromApi(
  value: string | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const dt = parseLocalDateFromApi(value);
  if (!dt) return typeof value === 'string' ? value : '';
  return dt.toLocaleDateString(undefined, options ?? { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Pass expiry from API (ISO or datetime string) for display / tooltips */
export function formatPassExpiresForDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const dt = parseLocalDateFromApi(value);
  if (dt) return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const t = Date.parse(String(value));
  if (!Number.isNaN(t)) return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return String(value);
}
