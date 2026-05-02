export const SILVER_PASS_PRICE = 29.99;
export const GOLD_PASS_PRICE = 49.99;

export type PassTierId = 'gold' | 'silver';

/**
 * Amount charged for a pass purchase. Silver → Gold upgrade is the price difference only.
 */
export function chargeForPassSelection(
  planId: PassTierId,
  userPassStatus: 'Gold' | 'Silver' | 'None'
): number {
  if (planId === 'gold' && userPassStatus === 'Silver') {
    return Math.round((GOLD_PASS_PRICE - SILVER_PASS_PRICE) * 100) / 100;
  }
  return planId === 'gold' ? GOLD_PASS_PRICE : SILVER_PASS_PRICE;
}
