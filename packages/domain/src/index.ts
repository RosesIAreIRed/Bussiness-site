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
