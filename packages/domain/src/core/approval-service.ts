import { createDomainEvent } from '../events.js';
import { DomainError } from '../errors.js';
import type { UnitOfWork } from './repositories.js';
import type { Actor, Approval } from './types.js';

export class ApprovalNotFoundError extends DomainError {
  constructor(approvalId: string) {
    super('APPROVAL_NOT_FOUND', `Approval ${approvalId} не знайдено`, {
      details: { approvalId },
    });
  }
}

export class ApprovalForbiddenError extends DomainError {
  constructor() {
    super('APPROVAL_FORBIDDEN', 'Роль VIEWER не може вирішувати approvals');
  }
}

export class ApprovalAlreadyDecidedError extends DomainError {
  constructor(approvalId: string, status: string) {
    super('APPROVAL_ALREADY_DECIDED', `Approval ${approvalId} вже в стані ${status}`, {
      details: { approvalId, status },
    });
  }
}

export interface ApprovalDecisionResult {
  approval: Approval;
  /** Заповнюється, коли APPROVED CREATE_PRODUCT_FROM_CANDIDATE створив продукт. */
  createdProductId?: string;
}

/**
 * Approval Engine (ТЗ §19): рішення по чергах підтверджень.
 * Ідемпотентність: повторне decide з тим самим результатом повертає стан без
 * повторних side effects; конфліктне рішення — помилка.
 */
export class ApprovalService {
  constructor(private readonly uow: UnitOfWork) {}

  async decide(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    actor: Actor,
    comment?: string,
  ): Promise<ApprovalDecisionResult> {
    if (actor.role === 'VIEWER') {
      throw new ApprovalForbiddenError();
    }

    return this.uow(async (repos) => {
      const approval = await repos.approvals.findById(approvalId);
      if (!approval) {
        throw new ApprovalNotFoundError(approvalId);
      }

      if (approval.status !== 'PENDING') {
        if (approval.status === decision) {
          return { approval };
        }
        throw new ApprovalAlreadyDecidedError(approvalId, approval.status);
      }

      const decided = await repos.approvals.decide(approvalId, {
        status: decision,
        decidedBy: actor.userId,
        comment,
        decidedAt: new Date(),
      });

      await repos.audit.append({
        actorType: 'USER',
        actorId: actor.userId,
        action: `approval.${decision.toLowerCase()}`,
        entityType: 'approval',
        entityId: approvalId,
        metadata: {
          action: approval.action,
          targetEntityType: approval.entityType,
          targetEntityId: approval.entityId,
          comment: comment ?? null,
        },
      });

      await repos.outbox.append(
        createDomainEvent('ApprovalDecided', { approvalId, status: decision }),
      );

      if (decision === 'APPROVED' && approval.action === 'CREATE_PRODUCT_FROM_CANDIDATE') {
        const createdProductId = await this.createProductFromCandidate(repos, approval, actor);
        return { approval: decided, createdProductId };
      }

      return { approval: decided };
    });
  }

  private async createProductFromCandidate(
    repos: Parameters<Parameters<UnitOfWork>[0]>[0],
    approval: Approval,
    actor: Actor,
  ): Promise<string> {
    const candidate = await repos.candidates.findById(approval.entityId);
    if (!candidate) {
      throw new DomainError(
        'CANDIDATE_NOT_FOUND',
        `Кандидата ${approval.entityId} для approval ${approval.id} не знайдено`,
      );
    }

    const product = await repos.products.create({
      title: candidate.title,
      candidateId: candidate.id,
      status: 'DRAFT',
    });

    await repos.candidates.update(candidate.id, { status: 'TEST', decision: 'TEST' });

    await repos.audit.append({
      actorType: 'USER',
      actorId: actor.userId,
      action: 'product.created-from-candidate',
      entityType: 'product',
      entityId: product.id,
      metadata: { candidateId: candidate.id, approvalId: approval.id },
    });

    await repos.outbox.append(
      createDomainEvent('ProductCreatedFromCandidate', {
        productId: product.id,
        candidateId: candidate.id,
      }),
    );

    return product.id;
  }
}
