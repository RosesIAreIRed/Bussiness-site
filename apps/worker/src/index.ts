import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '@ormilo/config';
import { JOBS, QUEUES } from '@ormilo/contracts';
import { createPrismaClient, publishOutboxBatch } from '@ormilo/db';
import {
  checkDatabaseHealth,
  checkRedisHealth,
  createLogger,
  startHealthServer,
} from '@ormilo/observability';
import { createSystemJobProcessor } from './processor.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const OUTBOX_PUBLISH_INTERVAL_MS = 5_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({
    service: 'worker',
    level: env.LOG_LEVEL,
    pretty: env.APP_ENV === 'development',
  });

  // BullMQ вимагає maxRetriesPerRequest: null для blocking-зʼєднань.
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error: Error) => {
    logger.warn({ err: error.message }, 'redis connection error');
  });

  const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });

  // Health-сервер стартує до підключення черг: якщо Redis/БД лежать,
  // /health чесно віддасть 503 замість того, щоб процес завис без діагностики.
  const healthServer = await startHealthServer({
    service: 'worker',
    port: env.WORKER_HEALTH_PORT,
    checks: [() => checkRedisHealth(connection), () => checkDatabaseHealth(prisma)],
    logger,
  });
  logger.info({ port: healthServer.port }, 'health-сервер запущено');

  const systemQueue = new Queue(QUEUES.system, { connection });
  // Queue тримає власне duplicated-зʼєднання: без listener-а помилки
  // друкуються в stderr повз структурований лог.
  systemQueue.on('error', (error) => {
    logger.warn({ err: error.message }, 'queue error');
  });

  const processor = createSystemJobProcessor({
    logger,
    publishOutbox: () =>
      publishOutboxBatch(prisma, {
        enqueue: async (event) => {
          // jobId = id події → повторна публікація не створює дубль (idempotency).
          await systemQueue.add(JOBS.domainEvent, event, {
            jobId: `evt-${event.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          });
        },
      }),
  });

  const worker = new Worker(QUEUES.system, (job) => processor(job), {
    connection,
    concurrency: 5,
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err: error.message }, 'job failed');
  });
  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, jobName: job.name }, 'job completed');
  });
  worker.on('error', (error) => {
    logger.warn({ err: error.message }, 'worker error');
  });

  // Repeatable jobs через job scheduler: upsert — idempotent,
  // повторний старт worker-а не створює дублікатів.
  await systemQueue.upsertJobScheduler(
    'worker-heartbeat',
    { every: HEARTBEAT_INTERVAL_MS },
    { name: JOBS.systemHeartbeat, data: { source: 'worker' } },
  );
  await systemQueue.upsertJobScheduler(
    'outbox-publish',
    { every: OUTBOX_PUBLISH_INTERVAL_MS },
    { name: JOBS.outboxPublish, data: {} },
  );

  logger.info(
    {
      queue: QUEUES.system,
      heartbeatEveryMs: HEARTBEAT_INTERVAL_MS,
      outboxEveryMs: OUTBOX_PUBLISH_INTERVAL_MS,
    },
    'worker готовий',
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'зупинка worker-а');
    await worker.close();
    await systemQueue.close();
    await healthServer.close();
    await prisma.$disconnect();
    connection.disconnect();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
  process.stderr.write(`worker не зміг стартувати: ${message}\n`);
  process.exit(1);
});
