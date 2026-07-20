import { DomainError } from '../errors.js';
import type { PriceEconomics, PricingAssumptions, PricingResult } from './types.js';

/** Дефолтні припущення калькулятора (ТЗ §2.3); можна перевизначати. */
export const PRICING_DEFAULTS: PricingAssumptions = {
  paymentFeeRate: 0.029,
  paymentFeeFixed: 0.3,
  refundReserveRate: 0.03,
  platformFeeRate: 0.01,
  minimumViableMarginRatio: 0.5,
  targetMarginRatio: 0.65,
  compareAtMultiplier: 1.35,
  bundleSize: 2,
  bundleDiscountRate: 0.15,
};

export class PricingError extends DomainError {
  constructor(message: string) {
    super('PRICING_INVALID', message);
  }
}

export interface PricingInput {
  supplierCost: number;
  shippingCost?: number;
  assumptions?: Partial<PricingAssumptions>;
}

interface CostModel {
  fixedCost: number;
  rateSum: number;
}

function buildCostModel(supplierCost: number, shippingCost: number, a: PricingAssumptions): CostModel {
  return {
    fixedCost: supplierCost + shippingCost + a.paymentFeeFixed,
    rateSum: a.paymentFeeRate + a.refundReserveRate + a.platformFeeRate,
  };
}

/** «Чарівне» заокруглення до x.99 угору (ніколи не нижче за вхідну ціну). */
export function charmPrice(value: number): number {
  const base = Math.floor(value);
  const candidate = base + 0.99;
  return round2(candidate >= value ? candidate : base + 1.99);
}

/**
 * Ціна, за якої contribution margin (до реклами) досягає цільової частки:
 *   price - fixedCost - price*rateSum >= targetRatio * price
 *   ⇒ price >= fixedCost / (1 - rateSum - targetRatio)
 */
function priceForMarginRatio(model: CostModel, targetRatio: number): number {
  const denominator = 1 - model.rateSum - targetRatio;
  if (denominator <= 0) {
    throw new PricingError(
      `Цільова маржа ${targetRatio} недосяжна за комісій ${model.rateSum} — перевірте припущення`,
    );
  }
  return model.fixedCost / denominator;
}

function economics(price: number, model: CostModel): PriceEconomics {
  const contributionMargin = price - model.fixedCost - price * model.rateSum;
  const marginRatio = contributionMargin / price;
  if (contributionMargin <= 0) {
    return {
      price: round2(price),
      contributionMargin: round2(contributionMargin),
      marginRatio: round2(marginRatio),
      breakEvenCpa: 0,
      // Маржі немає — жоден ROAS не робить продаж беззбитковим (null = недосяжно).
      breakEvenRoas: null,
    };
  }
  return {
    price: round2(price),
    contributionMargin: round2(contributionMargin),
    marginRatio: round2(marginRatio),
    // Break-even CPA = contribution margin до реклами (ТЗ §2.3).
    breakEvenCpa: round2(contributionMargin),
    // Break-even ROAS = 1 / contribution margin ratio (ТЗ §2.3).
    breakEvenRoas: round2(1 / marginRatio),
  };
}

/** Економіка конкретної ціни (для фактичної selling price кандидата). */
export function evaluatePriceEconomics(
  price: number,
  input: PricingInput,
): PriceEconomics {
  if (!(price > 0)) {
    throw new PricingError(`Ціна має бути > 0, отримано ${price}`);
  }
  const assumptions = { ...PRICING_DEFAULTS, ...input.assumptions };
  const model = buildCostModel(input.supplierCost, input.shippingCost ?? 0, assumptions);
  return economics(price, model);
}

/** Повний розрахунок цін (ТЗ §2.3: min viable / recommended / compare-at / bundle). */
export function computePricing(input: PricingInput): PricingResult {
  if (!(input.supplierCost >= 0)) {
    throw new PricingError(`Собівартість має бути ≥ 0, отримано ${input.supplierCost}`);
  }
  const assumptions = { ...PRICING_DEFAULTS, ...input.assumptions };
  const model = buildCostModel(input.supplierCost, input.shippingCost ?? 0, assumptions);

  const minimumViablePrice = charmPrice(
    priceForMarginRatio(model, assumptions.minimumViableMarginRatio),
  );
  const recommendedPrice = charmPrice(priceForMarginRatio(model, assumptions.targetMarginRatio));
  const compareAtPrice = charmPrice(recommendedPrice * assumptions.compareAtMultiplier);
  const bundlePrice = charmPrice(
    recommendedPrice * assumptions.bundleSize * (1 - assumptions.bundleDiscountRate),
  );

  return {
    assumptions,
    minimumViablePrice,
    recommendedPrice,
    compareAtPrice,
    bundlePrice,
    atRecommended: economics(recommendedPrice, model),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
