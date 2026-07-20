/** Доменні типи Product Intelligence (ТЗ §2.2, §14, §15, §2.3). */

/** Нормалізовані дані кандидата (ТЗ §2.2 поля; числа — після коерції). */
export interface NormalizedCandidate {
  productName: string;
  sellingPrice: number | null;
  compareAtPrice: number | null;
  estimatedCost: number | null;
  shippingEstimate: number | null;
  estimatedDaysRunning: number | null;
  activeCreativeCount: number | null;
  offer: string | null;
  currency: string | null;
}

/** Product Intelligence Brief (структура з ТЗ §14 ProductBriefSchema). */
export interface ProductBrief {
  summary: string;
  targetPersonas: Array<{
    name: string;
    pains: string[];
    desires: string[];
    objections: string[];
  }>;
  benefits: Array<{
    benefit: string;
    evidence: string | null;
    confidence: number;
  }>;
  angles: Array<{
    name: string;
    rationale: string;
    hooks: string[];
  }>;
  riskyClaims: Array<{
    claim: string;
    reason: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

/** Оцінки факторів 0..1, які виставляє AI/аналітик (ваги — у scoring). */
export interface ScoreRatings {
  visualDemoPotential: number;
  landingPageQuality: number;
  offerStrength: number;
  fulfillmentQuality: number;
  trustAndReviews: number;
  differentiation: number;
}

/** Серйозність ризиків 0..1 (штрафи — у scoring, ТЗ §2.2). */
export interface PenaltySeverities {
  policyRisk: number;
  copyrightRisk: number;
  fragileOrExpensiveShipping: number;
  unrealisticClaims: number;
  weakSupplierReliability: number;
  saturatedCommodity: number;
}

/** Структурована AI-оцінка кандидата (ТЗ §2.2 «Автоматичні результати аналізу»). */
export interface CandidateAssessment {
  whyItCanSell: string[];
  whyItCanFail: string[];
  recommendedOffer: string;
  missingMaterials: string[];
  ratings: ScoreRatings;
  penalties: PenaltySeverities;
}

export type ComplianceStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCKED';
export type ComplianceSeverity = 'WARNING' | 'BLOCKER';

export interface ComplianceFinding {
  ruleId: string;
  severity: ComplianceSeverity;
  message: string;
  match: string;
}

/** Звіт Compliance Guard (ТЗ §15). */
export interface ComplianceReport {
  status: ComplianceStatus;
  findings: ComplianceFinding[];
}

export type AutoDecision = 'REJECT' | 'WATCH' | 'TEST';

export interface ScoreFactorResult {
  key: string;
  weight: number;
  score: number;
  points: number;
}

export interface ScorePenaltyResult {
  key: string;
  maxPenalty: number;
  severity: number;
  points: number;
}

/** Розгорнутий результат scoring 0–100 (ТЗ §2.2). */
export interface ProductScore {
  factors: ScoreFactorResult[];
  penalties: ScorePenaltyResult[];
  rawTotal: number;
  total: number;
  criticalFlags: string[];
  autoDecision: AutoDecision;
}

export interface PricingAssumptions {
  paymentFeeRate: number;
  paymentFeeFixed: number;
  refundReserveRate: number;
  platformFeeRate: number;
  minimumViableMarginRatio: number;
  targetMarginRatio: number;
  compareAtMultiplier: number;
  bundleSize: number;
  bundleDiscountRate: number;
}

export interface PriceEconomics {
  price: number;
  contributionMargin: number;
  marginRatio: number;
  breakEvenCpa: number;
  /** null = беззбитковість недосяжна (немає маржі); JSON-safe замість Infinity. */
  breakEvenRoas: number | null;
}

/** Результат pricing-калькулятора (ТЗ §2.3). */
export interface PricingResult {
  assumptions: PricingAssumptions;
  minimumViablePrice: number;
  recommendedPrice: number;
  compareAtPrice: number;
  bundlePrice: number;
  atRecommended: PriceEconomics;
}

/** Використана версія промпту (traceability, ТЗ §14). */
export interface UsedPrompt {
  key: string;
  version: number;
}

/** Повний результат аналізу — зберігається в product_candidates.normalized_data_json. */
export interface AnalysisResult {
  analyzedAt: string;
  prompts: UsedPrompt[];
  normalized: NormalizedCandidate;
  brief: ProductBrief;
  assessment: CandidateAssessment;
  compliance: ComplianceReport;
  score: ProductScore;
  pricing: PricingResult | null;
  /** Економіка фактичної ціни продажу (якщо відома selling price). */
  sellingEconomics: PriceEconomics | null;
}
