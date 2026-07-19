import { createDomainEvent } from '../events.js';
import { DomainError } from '../errors.js';
import type { UnitOfWork } from './repositories.js';
import type { Actor, Approval, NewCandidate, ProductCandidate } from './types.js';

export class CandidateNotFoundError extends DomainError {
  constructor(candidateId: string) {
    super('CANDIDATE_NOT_FOUND', `Кандидата ${candidateId} не знайдено`, {
      details: { candidateId },
    });
  }
}

/**
 * Сервіс роботи з product candidates (ТЗ §2.2).
 * Кожна мутація атомарно пише запис + audit log + подію в outbox.
 */
export class CandidateService {
  constructor(private readonly uow: UnitOfWork) {}

  /** Ручне додавання кандидата (джерело MANUAL/URL; ТЗ §20 MVP п.3). */
  async createManual(input: NewCandidate, actor: Actor): Promise<ProductCandidate> {
    return this.uow(async (repos) => {
      const candidate = await repos.candidates.create(input);

      await repos.audit.append({
        actorType: 'USER',
        actorId: actor.userId,
        action: 'candidate.created',
        entityType: 'product_candidate',
        entityId: candidate.id,
        metadata: { title: candidate.title, sourceType: candidate.sourceType },
      });

      await repos.outbox.append(
        createDomainEvent('ProductCandidateImported', { candidateId: candidate.id }),
      );

      return candidate;
    });
  }

  /**
   * Запит approval на створення внутрішнього Product Draft із кандидата
   * (ТЗ §19, §22). Idempotent: повторний запит повертає наявний PENDING-approval.
   */
  async requestProductApproval(candidateId: string, actor: Actor): Promise<Approval> {
    return this.uow(async (repos) => {
      const candidate = await repos.candidates.findById(candidateId);
      if (!candidate) {
        throw new CandidateNotFoundError(candidateId);
      }

      const existing = await repos.approvals.findPendingFor(
        'product_candidate',
        candidateId,
        'CREATE_PRODUCT_FROM_CANDIDATE',
      );
      if (existing) {
        return existing;
      }

      const approval = await repos.approvals.create({
        entityType: 'product_candidate',
        entityId: candidateId,
        action: 'CREATE_PRODUCT_FROM_CANDIDATE',
        requestedBy: actor.userId,
        payload: { candidateTitle: candidate.title },
      });

      await repos.audit.append({
        actorType: 'USER',
        actorId: actor.userId,
        action: 'approval.requested',
        entityType: 'approval',
        entityId: approval.id,
        metadata: { action: approval.action, targetEntityId: candidateId },
      });

      await repos.outbox.append(createDomainEvent('ApprovalRequested', { approvalId: approval.id }));

      return approval;
    });
  }
}
