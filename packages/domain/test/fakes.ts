import type { DomainEvent } from '../src/events.js';
import type { TxRepos, UnitOfWork } from '../src/core/repositories.js';
import type {
  Approval,
  ApprovalStatus,
  AuditEntry,
  CandidateStatus,
  Product,
  ProductCandidate,
} from '../src/core/types.js';

/** In-memory реалізація TxRepos для unit-тестів сервісів (без БД). */
export interface FakeState {
  candidates: ProductCandidate[];
  products: Product[];
  approvals: Approval[];
  audit: AuditEntry[];
  outbox: DomainEvent[];
}

export function createFakeState(): FakeState {
  return { candidates: [], products: [], approvals: [], audit: [], outbox: [] };
}

export function createFakeRepos(state: FakeState): TxRepos {
  return {
    candidates: {
      create: async (data) => {
        const candidate: ProductCandidate = {
          id: crypto.randomUUID(),
          sourceType: data.sourceType,
          title: data.title,
          sourceUrl: data.sourceUrl ?? null,
          supplierUrl: data.supplierUrl ?? null,
          storeUrl: data.storeUrl ?? null,
          adLibraryUrl: data.adLibraryUrl ?? null,
          score: null,
          decision: null,
          status: 'INBOX',
          createdAt: new Date(),
        };
        state.candidates.push(candidate);
        return candidate;
      },
      findById: async (id) => state.candidates.find((c) => c.id === id) ?? null,
      list: async (params) =>
        state.candidates.filter((c) => !params?.status || c.status === params.status),
      update: async (id, patch) => {
        const candidate = state.candidates.find((c) => c.id === id);
        if (!candidate) throw new Error(`fake: candidate ${id} not found`);
        Object.assign(candidate, patch);
        return candidate;
      },
      countByStatus: async () => {
        const counts: Partial<Record<CandidateStatus, number>> = {};
        for (const candidate of state.candidates) {
          counts[candidate.status] = (counts[candidate.status] ?? 0) + 1;
        }
        return counts;
      },
    },
    products: {
      create: async (data) => {
        const product: Product = {
          id: crypto.randomUUID(),
          storeId: data.storeId ?? null,
          candidateId: data.candidateId ?? null,
          shopifyProductGid: null,
          title: data.title,
          handle: null,
          status: data.status ?? 'DRAFT',
          createdAt: new Date(),
        };
        state.products.push(product);
        return product;
      },
      findById: async (id) => state.products.find((p) => p.id === id) ?? null,
      list: async () => [...state.products],
      count: async () => state.products.length,
    },
    approvals: {
      create: async (data) => {
        const approval: Approval = {
          id: crypto.randomUUID(),
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          status: 'PENDING',
          requestedBy: data.requestedBy ?? null,
          decidedBy: null,
          comment: null,
          createdAt: new Date(),
          decidedAt: null,
        };
        state.approvals.push(approval);
        return approval;
      },
      findById: async (id) => state.approvals.find((a) => a.id === id) ?? null,
      findPendingFor: async (entityType, entityId, action) =>
        state.approvals.find(
          (a) =>
            a.entityType === entityType &&
            a.entityId === entityId &&
            a.action === action &&
            a.status === 'PENDING',
        ) ?? null,
      listByStatus: async (status: ApprovalStatus) =>
        state.approvals.filter((a) => a.status === status),
      listDecided: async () => state.approvals.filter((a) => a.status !== 'PENDING'),
      countPending: async () => state.approvals.filter((a) => a.status === 'PENDING').length,
      decide: async (id, patch) => {
        const approval = state.approvals.find((a) => a.id === id);
        if (!approval) throw new Error(`fake: approval ${id} not found`);
        Object.assign(approval, patch, { comment: patch.comment ?? null });
        return approval;
      },
    },
    audit: {
      append: async (entry) => {
        state.audit.push({
          id: crypto.randomUUID(),
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadataJson: entry.metadata ?? {},
          createdAt: new Date(),
        });
      },
      list: async () => [...state.audit],
    },
    outbox: {
      append: async (event) => {
        state.outbox.push(event);
      },
    },
  };
}

export function createFakeUow(state: FakeState): UnitOfWork {
  const repos = createFakeRepos(state);
  return (fn) => fn(repos);
}
