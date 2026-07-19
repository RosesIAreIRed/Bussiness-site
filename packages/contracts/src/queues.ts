import { z } from 'zod';

/** Назви BullMQ-черг системи. */
export const QUEUES = {
  system: 'system',
  render: 'render',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Назви job-типів. Формат: `<домен>.<дія>`. */
export const JOBS = {
  systemHeartbeat: 'system.heartbeat',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/**
 * Payload heartbeat-job.
 * Усі payload-и, що проходять через черги, валідуються Zod-схемами
 * на вході процесора (зовнішні дані для процесу-споживача).
 */
export const heartbeatJobPayloadSchema = z.object({
  source: z.string().min(1),
});

export type HeartbeatJobPayload = z.infer<typeof heartbeatJobPayloadSchema>;
