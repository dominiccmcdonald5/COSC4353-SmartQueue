/**
 * Front rows (rowIndex 0) → max price; back rows → min price. Linear by row.
 */
export function seatPriceForRowIndex(
  rowIndexFromFront: number,
  totalRows: number,
  min: number,
  max: number,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (totalRows <= 1) {
    return Math.round(((lo + hi) / 2) * 100) / 100;
  }
  const t = rowIndexFromFront / (totalRows - 1);
  const raw = hi - t * (hi - lo);
  return Math.round(raw * 100) / 100;
}
