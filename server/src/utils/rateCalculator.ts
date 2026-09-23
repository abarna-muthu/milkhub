import { MilkRate } from '../types/index.js';

export function calculateMilkRate(
  quantity: number,
  fat: number,
  snf: number,
  rateConfig: MilkRate,
  animalType: 'cow' | 'buffalo' = 'cow'
): { ratePerLitre: number; totalAmount: number } {
  let rate = rateConfig.base_rate;

  if (rateConfig.pricing_type === 'fat_snf') {
    // Dynamic calculation formula
    const fatDiff = fat - rateConfig.standard_fat;
    const snfDiff = snf - rateConfig.standard_snf;

    const fatAdj = fatDiff * rateConfig.fat_rate;
    const snfAdj = snfDiff * rateConfig.snf_rate;

    rate = rateConfig.base_rate + fatAdj + snfAdj;

    // Buffalo premium if applicable
    if (animalType === 'buffalo' && fat >= 6.0) {
      rate = Math.max(rate, 48.0);
    }

    // Minimum baseline floor
    rate = Math.max(rate, 28.0);
  }

  const roundedRate = Number(rate.toFixed(2));
  const totalAmount = Number((quantity * roundedRate).toFixed(2));

  return {
    ratePerLitre: roundedRate,
    totalAmount,
  };
}
