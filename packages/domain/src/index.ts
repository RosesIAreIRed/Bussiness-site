export {
  ok,
  err,
  isOk,
  isErr,
  unwrapOr,
  map,
  fromPromise,
  type Ok,
  type Err,
  type Result,
} from './result.js';

export { DomainError, UnknownJobTypeError } from './errors.js';

export { createDomainEvent, type DomainEvent } from './events.js';

// --- Security (ТЗ §16) ---
export { hashPassword, verifyPassword } from './security/passwords.js';
export {
  encryptString,
  decryptString,
  EncryptionError,
  DecryptionError,
} from './security/encryption.js';
export {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
  type SessionError,
} from './security/session.js';

// --- Core domain (M1, ТЗ §7/§19/§25) ---
export type {
  Actor,
  ActorType,
  Approval,
  ApprovalAction,
  ApprovalStatus,
  AuditEntry,
  CandidateDecision,
  CandidateSourceType,
  CandidateStatus,
  NewApproval,
  NewAuditEntry,
  NewCandidate,
  NewProduct,
  Product,
  ProductCandidate,
  ProductStatus,
  User,
  UserRole,
} from './core/types.js';

export type {
  ApprovalRepository,
  AuditLogRepository,
  CandidateRepository,
  CandidateWithData,
  OutboxRepository,
  ProductRepository,
  TxRepos,
  UnitOfWork,
  UserRepository,
} from './core/repositories.js';

export { CandidateService, CandidateNotFoundError } from './core/candidate-service.js';
export {
  ApprovalService,
  ApprovalNotFoundError,
  ApprovalForbiddenError,
  ApprovalAlreadyDecidedError,
  type ApprovalDecisionResult,
} from './core/approval-service.js';

export {
  computeOutboxBackoffMs,
  isOutboxExhausted,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_BASE_DELAY_MS,
  OUTBOX_MAX_DELAY_MS,
} from './core/outbox.js';

// --- Product Intelligence (M2, ТЗ §2.2/§2.3/§14/§15) ---
export type {
  AnalysisResult,
  AutoDecision,
  CandidateAssessment,
  ComplianceFinding,
  ComplianceReport,
  ComplianceSeverity,
  ComplianceStatus,
  NormalizedCandidate,
  PenaltySeverities,
  PriceEconomics,
  PricingAssumptions,
  PricingResult,
  ProductBrief,
  ProductScore,
  ScoreFactorResult,
  ScorePenaltyResult,
  ScoreRatings,
  UsedPrompt,
} from './research/types.js';

export { coerceNumber, normalizeCandidateData } from './research/normalize.js';

export {
  computeProductScore,
  adLongevityScore,
  creativeVariationsScore,
  grossMarginScore,
  SCORE_WEIGHTS,
  SCORE_PENALTIES,
  DECISION_THRESHOLDS,
  CRITICAL_SEVERITY,
  type ScoreDerivedInputs,
} from './research/scoring.js';

export {
  computePricing,
  evaluatePriceEconomics,
  charmPrice,
  PRICING_DEFAULTS,
  PricingError,
  type PricingInput,
} from './research/pricing.js';

export { checkCompliance, COMPLIANCE_RULES, type ComplianceInput } from './research/compliance.js';

export {
  CandidateAnalysisService,
  type AnalysisDeps,
  type AnalysisPrompt,
  type SchemaLike,
  type StructuredTextGenerator,
} from './research/analysis-service.js';
