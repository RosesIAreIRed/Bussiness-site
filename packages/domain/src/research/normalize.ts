import type { NormalizedCandidate } from './types.js';

/** Коерція числових значень із raw-даних: number або рядок із валютою/комами. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (cleaned === '') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (key in raw) {
      const value = coerceNumber(raw[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * Нормалізація raw-даних кандидата до єдиної схеми (ТЗ §2.2).
 * Джерела пишуть різні ключі — тут зводимо синоніми; відсутнє → null (чесно).
 */
export function normalizeCandidateData(input: {
  title: string;
  rawData: Record<string, unknown>;
}): NormalizedCandidate {
  const raw = input.rawData;
  return {
    productName: input.title,
    sellingPrice: pickNumber(raw, ['sellingPrice', 'selling_price', 'price']),
    compareAtPrice: pickNumber(raw, ['compareAtPrice', 'compare_at_price', 'compareAt']),
    estimatedCost: pickNumber(raw, [
      'estimatedCost',
      'estimated_cost',
      'supplierCost',
      'supplier_cost',
      'cost',
    ]),
    shippingEstimate: pickNumber(raw, [
      'shippingEstimate',
      'shipping_estimate',
      'shippingCost',
      'shipping_cost',
      'shipping',
    ]),
    estimatedDaysRunning: pickNumber(raw, [
      'estimatedDaysRunning',
      'estimated_days_running',
      'daysRunning',
      'days_running',
    ]),
    activeCreativeCount: pickNumber(raw, [
      'activeCreativeCount',
      'active_creative_count',
      'creativeCount',
      'creative_count',
    ]),
    offer: pickString(raw, ['offer']),
    currency: pickString(raw, ['currency']),
  };
}
