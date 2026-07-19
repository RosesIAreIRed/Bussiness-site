import { JOBS, QUEUES, heartbeatJobPayloadSchema } from '@ormilo/contracts';
import { UnknownJobTypeError } from '@ormilo/domain';
import type { Logger } from '@ormilo/observability';

export interface MinimalJob {
  name: string;
  id?: string;
  data: unknown;
}

export interface RenderJobResult {
  processedAt: string;
}

/**
 * Процесор render-черги. У Milestone 0 зареєстровано лише heartbeat;
 * render-джоби (Remotion/FFmpeg/Sharp) додаються в Milestone 3.
 * Невідомі job-типи падають у failed з типізованою помилкою.
 */
export function createRenderJobProcessor(logger: Logger) {
  return async (job: MinimalJob): Promise<RenderJobResult> => {
    if (job.name === JOBS.systemHeartbeat) {
      const payload = heartbeatJobPayloadSchema.parse(job.data);
      logger.debug({ source: payload.source, jobId: job.id }, 'heartbeat оброблено');
      return { processedAt: new Date().toISOString() };
    }

    throw new UnknownJobTypeError(QUEUES.render, job.name);
  };
}
