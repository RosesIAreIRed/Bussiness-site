import { z } from 'zod';
import type {
  AnalysisResult,
  CandidateAssessment,
  ComplianceReport,
  NormalizedCandidate,
  PenaltySeverities,
  PriceEconomics,
  PricingResult,
  ProductBrief,
  ProductScore,
  ScoreRatings,
} from '@ormilo/domain';

/**
 * Zod-схеми Product Intelligence (ТЗ §14, §2.2). Типи-джерело — @ormilo/domain;
 * анотації z.ZodType<...> гарантують, що схеми не розійдуться з типами.
 * Через ці схеми проходять УСІ AI-outputs і normalized_data_json.
 */

const rating01 = z.number().min(0).max(1);

export const scoreRatingsSchema: z.ZodType<ScoreRatings> = z.object({
  visualDemoPotential: rating01,
  landingPageQuality: rating01,
  offerStrength: rating01,
  fulfillmentQuality: rating01,
  trustAndReviews: rating01,
  differentiation: rating01,
});

export const penaltySeveritiesSchema: z.ZodType<PenaltySeverities> = z.object({
  policyRisk: rating01,
  copyrightRisk: rating01,
  fragileOrExpensiveShipping: rating01,
  unrealisticClaims: rating01,
  weakSupplierReliability: rating01,
  saturatedCommodity: rating01,
});

/** ТЗ §14 ProductBriefSchema. */
export const productBriefSchema: z.ZodType<ProductBrief> = z.object({
  summary: z.string().min(1),
  targetPersonas: z.array(
    z.object({
      name: z.string().min(1),
      pains: z.array(z.string()),
      desires: z.array(z.string()),
      objections: z.array(z.string()),
    }),
  ),
  benefits: z.array(
    z.object({
      benefit: z.string().min(1),
      evidence: z.string().nullable(),
      confidence: rating01,
    }),
  ),
  angles: z.array(
    z.object({
      name: z.string().min(1),
      rationale: z.string(),
      hooks: z.array(z.string()),
    }),
  ),
  riskyClaims: z.array(
    z.object({
      claim: z.string(),
      reason: z.string(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    }),
  ),
});

export const candidateAssessmentSchema: z.ZodType<CandidateAssessment> = z.object({
  whyItCanSell: z.array(z.string()),
  whyItCanFail: z.array(z.string()),
  recommendedOffer: z.string(),
  missingMaterials: z.array(z.string()),
  ratings: scoreRatingsSchema,
  penalties: penaltySeveritiesSchema,
});

export const normalizedCandidateSchema: z.ZodType<NormalizedCandidate> = z.object({
  productName: z.string(),
  sellingPrice: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  shippingEstimate: z.number().nullable(),
  estimatedDaysRunning: z.number().nullable(),
  activeCreativeCount: z.number().nullable(),
  offer: z.string().nullable(),
  currency: z.string().nullable(),
});

export const complianceReportSchema: z.ZodType<ComplianceReport> = z.object({
  status: z.enum(['PASS', 'PASS_WITH_WARNINGS', 'BLOCKED']),
  findings: z.array(
    z.object({
      ruleId: z.string(),
      severity: z.enum(['WARNING', 'BLOCKER']),
      message: z.string(),
      match: z.string(),
    }),
  ),
});

export const priceEconomicsSchema: z.ZodType<PriceEconomics> = z.object({
  price: z.number(),
  contributionMargin: z.number(),
  marginRatio: z.number(),
  breakEvenCpa: z.number(),
  breakEvenRoas: z.number().nullable(),
});

export const pricingResultSchema: z.ZodType<PricingResult> = z.object({
  assumptions: z.object({
    paymentFeeRate: z.number(),
    paymentFeeFixed: z.number(),
    refundReserveRate: z.number(),
    platformFeeRate: z.number(),
    minimumViableMarginRatio: z.number(),
    targetMarginRatio: z.number(),
    compareAtMultiplier: z.number(),
    bundleSize: z.number(),
    bundleDiscountRate: z.number(),
  }),
  minimumViablePrice: z.number(),
  recommendedPrice: z.number(),
  compareAtPrice: z.number(),
  bundlePrice: z.number(),
  atRecommended: priceEconomicsSchema,
});

export const productScoreSchema: z.ZodType<ProductScore> = z.object({
  factors: z.array(
    z.object({ key: z.string(), weight: z.number(), score: z.number(), points: z.number() }),
  ),
  penalties: z.array(
    z.object({
      key: z.string(),
      maxPenalty: z.number(),
      severity: z.number(),
      points: z.number(),
    }),
  ),
  rawTotal: z.number(),
  total: z.number().int().min(0).max(100),
  criticalFlags: z.array(z.string()),
  autoDecision: z.enum(['REJECT', 'WATCH', 'TEST']),
});

export const analysisResultSchema: z.ZodType<AnalysisResult> = z.object({
  analyzedAt: z.iso.datetime(),
  prompts: z.array(z.object({ key: z.string(), version: z.number().int() })),
  normalized: normalizedCandidateSchema,
  brief: productBriefSchema,
  assessment: candidateAssessmentSchema,
  compliance: complianceReportSchema,
  score: productScoreSchema,
  pricing: pricingResultSchema.nullable(),
  sellingEconomics: priceEconomicsSchema.nullable(),
});
