import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ApprovalRepository,
  AuditLogRepository,
  CandidateRepository,
  CandidateStatus,
  DomainEvent,
  OutboxRepository,
  ProductRepository,
  TxRepos,
  UnitOfWork,
  UserRepository,
} from '@ormilo/domain';

type Db = PrismaClient | Prisma.TransactionClient;

const DEFAULT_LIST_TAKE = 50;

function candidateRepository(db: Db): CandidateRepository {
  return {
    create: (data) =>
      db.productCandidate.create({
        data: {
          sourceType: data.sourceType,
          title: data.title,
          sourceUrl: data.sourceUrl ?? null,
          supplierUrl: data.supplierUrl ?? null,
          storeUrl: data.storeUrl ?? null,
          adLibraryUrl: data.adLibraryUrl ?? null,
          rawDataJson: (data.rawData ?? {}) as Prisma.InputJsonValue,
        },
      }),
    findById: (id) => db.productCandidate.findUnique({ where: { id } }),
    findByIdWithData: async (id) => {
      const row = await db.productCandidate.findUnique({ where: { id } });
      if (!row) return null;
      return {
        ...row,
        rawData: (row.rawDataJson ?? {}) as Record<string, unknown>,
        normalizedData: row.normalizedDataJson,
      };
    },
    list: (params) =>
      db.productCandidate.findMany({
        where: params?.status ? { status: params.status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: params?.take ?? DEFAULT_LIST_TAKE,
      }),
    update: (id, patch) => {
      const { normalizedData, ...rest } = patch;
      return db.productCandidate.update({
        where: { id },
        data: {
          ...rest,
          ...(normalizedData !== undefined
            ? { normalizedDataJson: normalizedData as Prisma.InputJsonValue }
            : {}),
        },
      });
    },
    countByStatus: async () => {
      const groups = await db.productCandidate.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      return Object.fromEntries(
        groups.map((group) => [group.status, group._count._all]),
      ) as Partial<Record<CandidateStatus, number>>;
    },
  };
}

function productRepository(db: Db): ProductRepository {
  return {
    create: (data) =>
      db.product.create({
        data: {
          title: data.title,
          candidateId: data.candidateId ?? null,
          storeId: data.storeId ?? null,
          status: data.status ?? 'DRAFT',
          contentJson: (data.content ?? {}) as Prisma.InputJsonValue,
        },
      }),
    findById: (id) => db.product.findUnique({ where: { id } }),
    list: (params) =>
      db.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: params?.take ?? DEFAULT_LIST_TAKE,
      }),
    count: () => db.product.count(),
  };
}

function approvalRepository(db: Db): ApprovalRepository {
  return {
    create: (data) =>
      db.approval.create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          requestedBy: data.requestedBy ?? null,
          payloadJson: (data.payload ?? {}) as Prisma.InputJsonValue,
        },
      }),
    findById: (id) => db.approval.findUnique({ where: { id } }),
    findPendingFor: (entityType, entityId, action) =>
      db.approval.findFirst({
        where: { entityType, entityId, action, status: 'PENDING' },
      }),
    listByStatus: (status, take) =>
      db.approval.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        take: take ?? DEFAULT_LIST_TAKE,
      }),
    listDecided: (take) =>
      db.approval.findMany({
        where: { status: { not: 'PENDING' } },
        orderBy: { decidedAt: 'desc' },
        take: take ?? DEFAULT_LIST_TAKE,
      }),
    countPending: () => db.approval.count({ where: { status: 'PENDING' } }),
    decide: (id, patch) =>
      db.approval.update({
        where: { id },
        data: {
          status: patch.status,
          decidedBy: patch.decidedBy,
          comment: patch.comment ?? null,
          decidedAt: patch.decidedAt,
        },
      }),
  };
}

function auditLogRepository(db: Db): AuditLogRepository {
  return {
    append: async (entry) => {
      await db.auditLog.create({
        data: {
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadataJson: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    },
    list: async (take) => {
      const rows = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: take ?? DEFAULT_LIST_TAKE,
      });
      return rows.map((row) => ({
        ...row,
        metadataJson: (row.metadataJson ?? {}) as Record<string, unknown>,
      }));
    },
  };
}

function outboxRepository(db: Db): OutboxRepository {
  return {
    /** Зберігає повний конверт події; id рядка = id події (ідемпотентний enqueue). */
    append: async (event: DomainEvent) => {
      await db.outboxEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payloadJson: event as unknown as Prisma.InputJsonValue,
        },
      });
    },
  };
}

export function createTxRepos(db: Db): TxRepos {
  return {
    candidates: candidateRepository(db),
    products: productRepository(db),
    approvals: approvalRepository(db),
    audit: auditLogRepository(db),
    outbox: outboxRepository(db),
  };
}

/** UnitOfWork поверх prisma.$transaction (ТЗ §25: database transactions). */
export function createUnitOfWork(prisma: PrismaClient): UnitOfWork {
  return (fn) => prisma.$transaction((tx) => fn(createTxRepos(tx)));
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    findById: (id) => prisma.user.findUnique({ where: { id } }),
  };
}
