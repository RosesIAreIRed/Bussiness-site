import type { DomainEvent } from '../events.js';
import type {
  Approval,
  ApprovalAction,
  ApprovalStatus,
  AuditEntry,
  CandidateDecision,
  CandidateStatus,
  NewApproval,
  NewAuditEntry,
  NewCandidate,
  NewProduct,
  Product,
  ProductCandidate,
  User,
} from './types.js';

/**
 * Інтерфейси репозиторіїв (ТЗ §25: repository/service pattern, dependency
 * inversion). Реалізації живуть у @ormilo/db; domain знає лише контракти.
 */

export interface CandidateRepository {
  create(data: NewCandidate): Promise<ProductCandidate>;
  findById(id: string): Promise<ProductCandidate | null>;
  list(params?: { status?: CandidateStatus; take?: number }): Promise<ProductCandidate[]>;
  update(
    id: string,
    patch: Partial<{
      status: CandidateStatus;
      decision: CandidateDecision;
      score: number;
    }>,
  ): Promise<ProductCandidate>;
  countByStatus(): Promise<Partial<Record<CandidateStatus, number>>>;
}

export interface ProductRepository {
  create(data: NewProduct): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  list(params?: { take?: number }): Promise<Product[]>;
  count(): Promise<number>;
}

export interface ApprovalRepository {
  create(data: NewApproval): Promise<Approval>;
  findById(id: string): Promise<Approval | null>;
  findPendingFor(
    entityType: string,
    entityId: string,
    action: ApprovalAction,
  ): Promise<Approval | null>;
  listByStatus(status: ApprovalStatus, take?: number): Promise<Approval[]>;
  listDecided(take?: number): Promise<Approval[]>;
  countPending(): Promise<number>;
  decide(
    id: string,
    patch: {
      status: Extract<ApprovalStatus, 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
      decidedBy: string;
      comment?: string;
      decidedAt: Date;
    },
  ): Promise<Approval>;
}

export interface AuditLogRepository {
  append(entry: NewAuditEntry): Promise<void>;
  list(take?: number): Promise<AuditEntry[]>;
}

export interface OutboxRepository {
  append(event: DomainEvent): Promise<void>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  findById(id: string): Promise<User | null>;
}

/** Репозиторії, доступні всередині однієї транзакції БД. */
export interface TxRepos {
  candidates: CandidateRepository;
  products: ProductRepository;
  approvals: ApprovalRepository;
  audit: AuditLogRepository;
  outbox: OutboxRepository;
}

/**
 * Unit of Work: виконує callback в одній транзакції БД (ТЗ §25: database
 * transactions). Усі записи сервісу — атомарні, включно з audit та outbox.
 */
export type UnitOfWork = <T>(fn: (repos: TxRepos) => Promise<T>) => Promise<T>;
