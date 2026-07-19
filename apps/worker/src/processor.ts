import {
  JOBS,
  QUEUES,
  domainEventEnvelopeSchema,
  domainEventPayloadSchemas,
  heartbeatJobPayloadSchema,
  isKnownDomainEventType,
} from '@ormilo/contracts';
import { UnknownJobTypeError } from '@ormilo/domain';
import type { Logger } from '@ormilo/observability';

export interface MinimalJob {
  name: string;
  id?: string;
  data: unknown;
}

export interface SystemJobResult {
  processedAt: string;
  published?: number;
  failed?: number;
}

export interface SystemProcessorDeps {
  logger: Logger;
  /** Публікує чергову партію outbox-подій (реалізація — @ormilo/db). */
  publishOutbox: () => Promise<{ published: number; failed: number }>;
}

/**
 * Процесор системної черги (ТЗ §8/§9). Обробка idempotent:
 * - heartbeat не мутує стан;
 * - outbox.publish захищений статус-guard-ами на рівні БД;
 * - domain-event джоби мають jobId = event id (BullMQ дедуплікує).
 * Невідомі job-типи падають у failed із типізованою помилкою.
 */
export function createSystemJobProcessor(deps: SystemProcessorDeps) {
  const { logger } = deps;

  return async (job: MinimalJob): Promise<SystemJobResult> => {
    if (job.name === JOBS.systemHeartbeat) {
      const payload = heartbeatJobPayloadSchema.parse(job.data);
      logger.debug({ source: payload.source, jobId: job.id }, 'heartbeat оброблено');
      return { processedAt: new Date().toISOString() };
    }

    if (job.name === JOBS.outboxPublish) {
      const result = await deps.publishOutbox();
      if (result.published > 0 || result.failed > 0) {
        const level = result.failed > 0 ? 'warn' : 'info';
        logger[level](result, 'outbox: публікація партії завершена');
      }
      return { processedAt: new Date().toISOString(), ...result };
    }

    if (job.name === JOBS.domainEvent) {
      const envelope = domainEventEnvelopeSchema.parse(job.data);

      if (isKnownDomainEventType(envelope.type)) {
        // Невалідний payload відомої події — помилка продюсера, job має впасти.
        const payload = domainEventPayloadSchemas[envelope.type].parse(envelope.payload);
        logger.info(
          { eventId: envelope.id, eventType: envelope.type, payload },
          'domain event оброблено',
        );
      } else {
        // Forward-compat: подія з новішого продюсера — фіксуємо, не падаємо.
        logger.warn(
          { eventId: envelope.id, eventType: envelope.type },
          'domain event невідомого типу — підтверджено без обробки',
        );
      }
      return { processedAt: new Date().toISOString() };
    }

    throw new UnknownJobTypeError(QUEUES.system, job.name);
  };
}
