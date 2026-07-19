import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ApprovalService, CandidateService, createDomainEvent } from '@ormilo/domain';
import { createTxRepos, createUnitOfWork } from '../src/repositories.js';
import { publishOutboxBatch } from '../src/outbox-publisher.js';

/**
 * Інтеграційні тести M1 проти реальної БД (міграції мають бути застосовані).
 * Запуск: INTEGRATION=1 DATABASE_URL=... pnpm --filter @ormilo/db test:integration
 */
const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('M1 core flow (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const uow = createUnitOfWork(prisma);
  const candidateService = new CandidateService(uow);
  const approvalService = new ApprovalService(uow);
  const actor = { userId: '', role: 'ADMIN' as const };

  beforeAll(async () => {
    // Чистий стан: тести працюють із виділеною БД (CI service / локальний compose).
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, audit_logs, approvals, assets, products, product_candidates, users RESTART IDENTITY CASCADE',
    );
    const user = await prisma.user.create({
      data: {
        email: 'integration@ormilo.local',
        name: 'Integration',
        role: 'ADMIN',
        passwordHash: 'scrypt-v1:unused:unused',
      },
    });
    actor.userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('UnitOfWork атомарний: помилка всередині транзакції відкочує всі записи', async () => {
    await expect(
      uow(async (repos) => {
        await repos.candidates.create({ sourceType: 'MANUAL', title: 'Rollback-кандидат' });
        throw new Error('навмисний збій');
      }),
    ).rejects.toThrow('навмисний збій');

    const count = await prisma.productCandidate.count({
      where: { title: 'Rollback-кандидат' },
    });
    expect(count).toBe(0);
  });

  it('повний цикл: кандидат → approval → approve → продукт + audit + outbox', async () => {
    const candidate = await candidateService.createManual(
      { sourceType: 'MANUAL', title: 'Інтеграційний блендер', sourceUrl: 'https://example.com/p' },
      actor,
    );

    const approval = await candidateService.requestProductApproval(candidate.id, actor);
    expect(approval.status).toBe('PENDING');

    // Idempotency: повторний запит не створює другий approval.
    const repeated = await candidateService.requestProductApproval(candidate.id, actor);
    expect(repeated.id).toBe(approval.id);

    const decision = await approvalService.decide(approval.id, 'APPROVED', actor, 'беремо');
    expect(decision.approval.status).toBe('APPROVED');
    expect(decision.createdProductId).toBeDefined();

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: decision.createdProductId! },
    });
    expect(product.title).toBe('Інтеграційний блендер');
    expect(product.status).toBe('DRAFT');

    const updatedCandidate = await prisma.productCandidate.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    expect(updatedCandidate.status).toBe('TEST');

    const auditActions = (
      await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
    ).map((entry) => entry.action);
    expect(auditActions).toEqual(
      expect.arrayContaining([
        'candidate.created',
        'approval.requested',
        'approval.approved',
        'product.created-from-candidate',
      ]),
    );

    const outboxTypes = (await prisma.outboxEvent.findMany()).map((event) => event.type);
    expect(outboxTypes).toEqual(
      expect.arrayContaining([
        'ProductCandidateImported',
        'ApprovalRequested',
        'ApprovalDecided',
        'ProductCreatedFromCandidate',
      ]),
    );
  });

  it('publishOutboxBatch: успіх → PUBLISHED, збій → retry з backoff, зіпсований конверт → FAILED', async () => {
    await prisma.outboxEvent.deleteMany();

    const good = createDomainEvent('ProductCandidateImported', {
      candidateId: crypto.randomUUID(),
    });
    const repos = createTxRepos(prisma);
    await repos.outbox.append(good);
    await prisma.outboxEvent.create({
      data: { type: 'Broken', payloadJson: { not: 'an envelope' } },
    });

    // Партія 1: enqueue падає → attempts=1, PENDING із майбутнім availableAt; broken → FAILED.
    const failing = await publishOutboxBatch(prisma, {
      enqueue: async () => {
        throw new Error('redis недоступний');
      },
    });
    expect(failing.published).toBe(0);
    expect(failing.failed).toBe(2);

    const afterFail = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: good.id } });
    expect(afterFail.status).toBe('PENDING');
    expect(afterFail.attempts).toBe(1);
    expect(afterFail.availableAt.getTime()).toBeGreaterThan(Date.now());

    const broken = await prisma.outboxEvent.findFirstOrThrow({ where: { type: 'Broken' } });
    expect(broken.status).toBe('FAILED');

    // Партія 2 (availableAt у майбутньому → без "now" подія ще не доступна).
    const delivered: string[] = [];
    const early = await publishOutboxBatch(prisma, {
      enqueue: async (event) => {
        delivered.push(event.id);
      },
    });
    expect(early.published).toBe(0);

    // Партія 3: із "now" пізніше за availableAt → доставлено і позначено PUBLISHED.
    const late = await publishOutboxBatch(prisma, {
      now: new Date(Date.now() + 10 * 60_000),
      enqueue: async (event) => {
        delivered.push(event.id);
      },
    });
    expect(late.published).toBe(1);
    expect(delivered).toEqual([good.id]);

    const published = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: good.id } });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
  });
});
