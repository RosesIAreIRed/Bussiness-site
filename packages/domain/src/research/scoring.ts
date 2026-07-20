import type {
  AutoDecision,
  PenaltySeverities,
  ProductScore,
  ScoreFactorResult,
  ScorePenaltyResult,
  ScoreRatings,
} from './types.js';

/** Ваги факторів (ТЗ §2.2 «Система оцінки 0–100»; сума = 100). */
export const SCORE_WEIGHTS = {
  adLongevity: 15,
  creativeVariations: 10,
  visualDemoPotential: 15,
  grossMargin: 15,
  landingPageQuality: 10,
  offerStrength: 10,
  fulfillmentQuality: 10,
  trustAndReviews: 5,
  differentiation: 10,
} as const;

/** Максимальні штрафи (ТЗ §2.2 «Штрафи»). */
export const SCORE_PENALTIES = {
  policyRisk: 25,
  copyrightRisk: 30,
  fragileOrExpensiveShipping: 15,
  unrealisticClaims: 20,
  weakSupplierReliability: 20,
  saturatedCommodity: 15,
} as const;

/** Пороги авто-рішення: <65 → REJECT (ТЗ §2.2); 65–74 → WATCH; ≥75 → TEST. */
export const DECISION_THRESHOLDS = { watch: 65, test: 75 } as const;

/** Severity ≥ 0.8 для policy/copyright — критичний red flag (авто-REJECT). */
export const CRITICAL_SEVERITY = 0.8;
const CRITICAL_PENALTY_KEYS: ReadonlyArray<keyof PenaltySeverities> = [
  'policyRisk',
  'copyrightRisk',
];

export interface ScoreDerivedInputs {
  estimatedDaysRunning: number | null;
  activeCreativeCount: number | null;
  grossMarginRatio: number | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Тривалість реклами → 0..1 (довше крутиться — сильніший сигнал). */
export function adLongevityScore(days: number | null): number {
  if (days === null) return 0.3;
  if (days >= 60) return 1;
  if (days >= 30) return 0.7;
  if (days >= 14) return 0.4;
  return 0.2;
}

/** Кількість активних креативів → 0..1. */
export function creativeVariationsScore(count: number | null): number {
  if (count === null) return 0.3;
  if (count >= 10) return 1;
  if (count >= 5) return 0.7;
  if (count >= 2) return 0.4;
  return 0.2;
}

/** Валова маржа (частка від ціни) → 0..1; невідома маржа = 0 (без даних немає довіри). */
export function grossMarginScore(ratio: number | null): number {
  if (ratio === null) return 0;
  if (ratio >= 0.75) return 1;
  if (ratio >= 0.65) return 0.85;
  if (ratio >= 0.55) return 0.65;
  if (ratio >= 0.45) return 0.4;
  return 0.15;
}

/**
 * Обчислення Product Score 0–100 (ТЗ §2.2): зважені фактори мінус штрафи.
 * Критичний red flag (policy/copyright ≥ 0.8) → авто-REJECT незалежно від суми.
 */
export function computeProductScore(
  derived: ScoreDerivedInputs,
  ratings: ScoreRatings,
  penalties: PenaltySeverities,
): ProductScore {
  const factorScores: Record<keyof typeof SCORE_WEIGHTS, number> = {
    adLongevity: adLongevityScore(derived.estimatedDaysRunning),
    creativeVariations: creativeVariationsScore(derived.activeCreativeCount),
    visualDemoPotential: clamp01(ratings.visualDemoPotential),
    grossMargin: grossMarginScore(derived.grossMarginRatio),
    landingPageQuality: clamp01(ratings.landingPageQuality),
    offerStrength: clamp01(ratings.offerStrength),
    fulfillmentQuality: clamp01(ratings.fulfillmentQuality),
    trustAndReviews: clamp01(ratings.trustAndReviews),
    differentiation: clamp01(ratings.differentiation),
  };

  const factors: ScoreFactorResult[] = (
    Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>
  ).map((key) => {
    const weight = SCORE_WEIGHTS[key];
    const score = factorScores[key];
    return { key, weight, score, points: round2(weight * score) };
  });

  const penaltyResults: ScorePenaltyResult[] = (
    Object.keys(SCORE_PENALTIES) as Array<keyof typeof SCORE_PENALTIES>
  ).map((key) => {
    const maxPenalty = SCORE_PENALTIES[key];
    const severity = clamp01(penalties[key]);
    return { key, maxPenalty, severity, points: round2(-maxPenalty * severity) };
  });

  const positive = factors.reduce((sum, factor) => sum + factor.points, 0);
  const negative = penaltyResults.reduce((sum, penalty) => sum + penalty.points, 0);
  const rawTotal = round2(positive + negative);
  const total = Math.round(Math.min(100, Math.max(0, rawTotal)));

  const criticalFlags = CRITICAL_PENALTY_KEYS.filter(
    (key) => clamp01(penalties[key]) >= CRITICAL_SEVERITY,
  );

  const autoDecision: AutoDecision =
    criticalFlags.length > 0 || total < DECISION_THRESHOLDS.watch
      ? 'REJECT'
      : total >= DECISION_THRESHOLDS.test
        ? 'TEST'
        : 'WATCH';

  return { factors, penalties: penaltyResults, rawTotal, total, criticalFlags, autoDecision };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
