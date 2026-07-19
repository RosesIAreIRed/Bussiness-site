import { JOBS, QUEUES, heartbeatJobPayloadSchema } from '@ormilo/contracts';
import { UnknownJobTypeError } from '@ormilo/domain';
import type { Logger } from '@ormilo/observability';

export interface MinimalJob {
  name: string;
  id?: string;
  data: unknown;
}

export interface SystemJobResult {
  processedAt: string;
}

/**
 * Процесор системної черги. Обробка idempotent: heartbeat не мутує стан,
 * повторна обробка того самого job безпечна. Невідомі job-типи падають
 * у failed із типізованою помилкою — без тихого ігнорування.
 */
export function createSystemJobProcessor(logger: Logger) {
  return async (job: MinimalJob): Promise<SystemJobResult> => {
    if (job.name === JOBS.systemHeartbeat) {
      const payload = heartbeatJobPayloadSchema.parse(job.data);
      logger.debug({ source: payload.source, jobId: job.id }, 'heartbeat оброблено');
      return { processedAt: new Date().toISOString() };
    }

    throw new UnknownJobTypeError(QUEUES.system, job.name);
  };
}
