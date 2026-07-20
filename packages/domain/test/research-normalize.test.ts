import { describe, expect, it } from 'vitest';
import { coerceNumber, normalizeCandidateData } from '../src/research/normalize.js';

describe('normalizeCandidateData (ТЗ §2.2)', () => {
  it('коерсить числа з рядків із валютою та комами', () => {
    expect(coerceNumber(12.5)).toBe(12.5);
    expect(coerceNumber('19.99')).toBe(19.99);
    expect(coerceNumber('$24,99')).toBe(24.99);
    expect(coerceNumber('')).toBeNull();
    expect(coerceNumber('n/a')).toBeNull();
    expect(coerceNumber(Number.NaN)).toBeNull();
    expect(coerceNumber({})).toBeNull();
  });

  it('зводить синонімічні ключі до єдиної схеми', () => {
    const normalized = normalizeCandidateData({
      title: 'Блендер',
      rawData: {
        price: '29.99',
        supplier_cost: 7,
        shipping: '2.5',
        days_running: 45,
        creativeCount: 8,
        offer: '2 за ціною 1',
        currency: 'USD',
      },
    });

    expect(normalized).toEqual({
      productName: 'Блендер',
      sellingPrice: 29.99,
      compareAtPrice: null,
      estimatedCost: 7,
      shippingEstimate: 2.5,
      estimatedDaysRunning: 45,
      activeCreativeCount: 8,
      offer: '2 за ціною 1',
      currency: 'USD',
    });
  });

  it('відсутні дані чесно лишаються null', () => {
    const normalized = normalizeCandidateData({ title: 'X', rawData: {} });
    expect(normalized.sellingPrice).toBeNull();
    expect(normalized.estimatedCost).toBeNull();
    expect(normalized.offer).toBeNull();
  });
});
