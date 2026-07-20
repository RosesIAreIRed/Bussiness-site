import { describe, expect, it } from 'vitest';
import {
  PRICING_DEFAULTS,
  PricingError,
  charmPrice,
  computePricing,
  evaluatePriceEconomics,
} from '../src/research/pricing.js';

describe('pricing (ТЗ §2.3)', () => {
  it('charmPrice заокруглює до .99 не нижче за вхідну ціну', () => {
    expect(charmPrice(24.1)).toBe(24.99);
    expect(charmPrice(24.99)).toBe(24.99);
    expect(charmPrice(25.0)).toBe(25.99);
  });

  it('рахує повний набір цін і break-even метрики', () => {
    const result = computePricing({ supplierCost: 6, shippingCost: 2 });

    expect(result.minimumViablePrice).toBeLessThan(result.recommendedPrice);
    expect(result.compareAtPrice).toBeGreaterThan(result.recommendedPrice);
    expect(result.bundlePrice).toBeGreaterThan(result.recommendedPrice);
    // Бандл із 2 одиниць зі знижкою — дешевший за дві окремі.
    expect(result.bundlePrice).toBeLessThan(result.recommendedPrice * 2);

    const eco = result.atRecommended;
    // Рекомендована ціна досягає цільової маржі (заокруглення тільки вгору).
    expect(eco.marginRatio).toBeGreaterThanOrEqual(PRICING_DEFAULTS.targetMarginRatio);
    // Break-even CPA = contribution margin до реклами.
    expect(eco.breakEvenCpa).toBe(eco.contributionMargin);
    // Break-even ROAS = 1 / contribution margin ratio (формула з ТЗ).
    expect(eco.breakEvenRoas).toBeCloseTo(1 / eco.marginRatio, 1);
  });

  it('evaluatePriceEconomics узгоджений із формулою вручну', () => {
    const price = 29.99;
    const eco = evaluatePriceEconomics(price, { supplierCost: 6, shippingCost: 2 });

    const rateSum =
      PRICING_DEFAULTS.paymentFeeRate +
      PRICING_DEFAULTS.refundReserveRate +
      PRICING_DEFAULTS.platformFeeRate;
    const expectedCm = price - (6 + 2 + PRICING_DEFAULTS.paymentFeeFixed) - price * rateSum;
    expect(eco.contributionMargin).toBeCloseTo(expectedCm, 2);
  });

  it('збиткова ціна → нульовий CPA і недосяжний ROAS (null)', () => {
    const eco = evaluatePriceEconomics(5, { supplierCost: 6, shippingCost: 2 });
    expect(eco.contributionMargin).toBeLessThan(0);
    expect(eco.breakEvenCpa).toBe(0);
    expect(eco.breakEvenRoas).toBeNull();
  });

  it('відхиляє недосяжну цільову маржу та невалідні входи', () => {
    expect(() =>
      computePricing({ supplierCost: 6, assumptions: { targetMarginRatio: 0.97 } }),
    ).toThrow(PricingError);
    expect(() => computePricing({ supplierCost: -1 })).toThrow(PricingError);
    expect(() => evaluatePriceEconomics(0, { supplierCost: 6 })).toThrow(PricingError);
  });

  it('дорожча доставка піднімає всі ціни', () => {
    const cheap = computePricing({ supplierCost: 6, shippingCost: 1 });
    const expensive = computePricing({ supplierCost: 6, shippingCost: 6 });
    expect(expensive.recommendedPrice).toBeGreaterThan(cheap.recommendedPrice);
    expect(expensive.minimumViablePrice).toBeGreaterThan(cheap.minimumViablePrice);
  });
});
