import { describe, expect, it } from 'vitest';
import {
  DECISION_THRESHOLDS,
  SCORE_PENALTIES,
  SCORE_WEIGHTS,
  adLongevityScore,
  computeProductScore,
  creativeVariationsScore,
  grossMarginScore,
} from '../src/research/scoring.js';
import type { PenaltySeverities, ScoreRatings } from '../src/research/types.js';

const perfectRatings: ScoreRatings = {
  visualDemoPotential: 1,
  landingPageQuality: 1,
  offerStrength: 1,
  fulfillmentQuality: 1,
  trustAndReviews: 1,
  differentiation: 1,
};

const noPenalties: PenaltySeverities = {
  policyRisk: 0,
  copyrightRisk: 0,
  fragileOrExpensiveShipping: 0,
  unrealisticClaims: 0,
  weakSupplierReliability: 0,
  saturatedCommodity: 0,
};

describe('scoring (ТЗ §2.2)', () => {
  it('ваги факторів у сумі дають 100', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((acc, weight) => acc + weight, 0);
    expect(sum).toBe(100);
  });

  it('ідеальний кандидат отримує 100 і рішення TEST', () => {
    const score = computeProductScore(
      { estimatedDaysRunning: 90, activeCreativeCount: 12, grossMarginRatio: 0.8 },
      perfectRatings,
      noPenalties,
    );
    expect(score.total).toBe(100);
    expect(score.autoDecision).toBe('TEST');
    expect(score.criticalFlags).toHaveLength(0);
  });

  it('нижче порогу 65 — авто-REJECT (ТЗ: score ≥ 65 допускає до тесту)', () => {
    const weak = computeProductScore(
      { estimatedDaysRunning: null, activeCreativeCount: null, grossMarginRatio: null },
      {
        visualDemoPotential: 0.3,
        landingPageQuality: 0.3,
        offerStrength: 0.3,
        fulfillmentQuality: 0.3,
        trustAndReviews: 0.3,
        differentiation: 0.3,
      },
      noPenalties,
    );
    expect(weak.total).toBeLessThan(DECISION_THRESHOLDS.watch);
    expect(weak.autoDecision).toBe('REJECT');
  });

  it('діапазон 65–74 → WATCH, ≥75 → TEST', () => {
    const mid = computeProductScore(
      { estimatedDaysRunning: 30, activeCreativeCount: 5, grossMarginRatio: 0.6 },
      {
        visualDemoPotential: 0.7,
        landingPageQuality: 0.6,
        offerStrength: 0.6,
        fulfillmentQuality: 0.6,
        trustAndReviews: 0.6,
        differentiation: 0.6,
      },
      noPenalties,
    );
    expect(mid.total).toBeGreaterThanOrEqual(DECISION_THRESHOLDS.watch);
    expect(mid.total).toBeLessThan(DECISION_THRESHOLDS.test);
    expect(mid.autoDecision).toBe('WATCH');
  });

  it('критичний copyright-ризик (≥0.8) → REJECT навіть із високим балом', () => {
    const score = computeProductScore(
      { estimatedDaysRunning: 90, activeCreativeCount: 12, grossMarginRatio: 0.8 },
      perfectRatings,
      { ...noPenalties, copyrightRisk: 0.85 },
    );
    expect(score.criticalFlags).toContain('copyrightRisk');
    expect(score.autoDecision).toBe('REJECT');
  });

  it('штрафи віднімаються пропорційно severity', () => {
    const base = computeProductScore(
      { estimatedDaysRunning: 90, activeCreativeCount: 12, grossMarginRatio: 0.8 },
      perfectRatings,
      noPenalties,
    );
    const penalized = computeProductScore(
      { estimatedDaysRunning: 90, activeCreativeCount: 12, grossMarginRatio: 0.8 },
      perfectRatings,
      { ...noPenalties, saturatedCommodity: 1 },
    );
    expect(base.total - penalized.total).toBe(SCORE_PENALTIES.saturatedCommodity);
  });

  it('шкали факторів монотонні та обмежені', () => {
    expect(adLongevityScore(90)).toBe(1);
    expect(adLongevityScore(45)).toBe(0.7);
    expect(adLongevityScore(20)).toBe(0.4);
    expect(adLongevityScore(3)).toBe(0.2);
    expect(adLongevityScore(null)).toBe(0.3);

    expect(creativeVariationsScore(15)).toBe(1);
    expect(creativeVariationsScore(null)).toBe(0.3);

    expect(grossMarginScore(0.8)).toBe(1);
    expect(grossMarginScore(0.5)).toBe(0.4);
    expect(grossMarginScore(null)).toBe(0);
  });

  it('невалідні значення ratings клампляться в 0..1', () => {
    const score = computeProductScore(
      { estimatedDaysRunning: 90, activeCreativeCount: 12, grossMarginRatio: 0.8 },
      { ...perfectRatings, offerStrength: 5, trustAndReviews: -3 },
      noPenalties,
    );
    const offer = score.factors.find((factor) => factor.key === 'offerStrength')!;
    const trust = score.factors.find((factor) => factor.key === 'trustAndReviews')!;
    expect(offer.score).toBe(1);
    expect(trust.score).toBe(0);
  });
});
