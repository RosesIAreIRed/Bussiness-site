import type { Prisma, PrismaClient } from '@prisma/client';
import { computeOutboxBackoffMs, isOutboxExhausted, OUTBOX_MAX_ATTEMPTS } from '@ormilo/domain';
import { domainEventEnvelopeSchema, type DomainEventEnvelope } from '@ormilo/contracts';

export interface PublishOutboxOptions {
  /** Доставляє подію в чергу; кидає помилку при невдачі. */
  enqueue: (event: DomainEventEnvelope) => Promise<void>;
  limit?: number;
  now?: Date;
}

export interface OutboxPublishResult {
  published: number;
  failed: number;
}

/**
 * Публікація outbox-подій (ТЗ §8): PENDING → enqueue → PUBLISHED.
 * Невдача: attempts+1, exponential backoff; після OUTBOX_MAX_ATTEMPTS — FAILED
 * (dead-letter, видно на дашборді failures §17). Розрахований на один активний
 * publisher-процес (guard по status при апдейті захищає від подвійного маркування).
 */
export async function publishOutboxBatch(
  prisma: PrismaClient,
  options: PublishOutboxOptions,
): Promise<OutboxPublishResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 20;

  const pending = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING', availableAt: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let published = 0;
  let failed = 0;

  for (const row of pending) {
    const parsed = domainEventEnvelopeSchema.safeParse(row.payloadJson);

    if (!parsed.success) {
      // Пошкоджений конверт не має шансів на успішний retry — одразу dead-letter.
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          attempts: OUTBOX_MAX_ATTEMPTS,
          lastErrorJson: {
            message: 'Невалідний конверт події',
            issues: parsed.error.issues.map((issue) => issue.message),
          } as Prisma.InputJsonValue,
        },
      });
      failed += 1;
      continue;
    }

    try {
      await options.enqueue(parsed.data);
      await prisma.outboxEvent.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      published += 1;
    } catch (cause) {
      const attempts = row.attempts + 1;
      const exhausted = isOutboxExhausted(attempts);
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          attempts,
          status: exhausted ? 'FAILED' : 'PENDING',
          availableAt: new Date(now.getTime() + computeOutboxBackoffMs(attempts)),
          lastErrorJson: {
            message: cause instanceof Error ? cause.message : String(cause),
          } as Prisma.InputJsonValue,
        },
      });
      failed += 1;
    }
  }

  return { published, failed };
}
