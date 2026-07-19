import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '@ormilo/config';
import { JOBS, QUEUES } from '@ormilo/contracts';
import { checkRedisHealth, createLogger, startHealthServer } from '@ormilo/observability';
import { createRenderJobProcessor } from './processor.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({
    service: 'render-worker',
    level: env.LOG_LEVEL,
    pretty: env.APP_ENV === 'development',
  });

  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error: Error) => {
    logger.warn({ err: error.message }, 'redis connection error');
  });

  const healthServer = await startHealthServer({
    service: 'render-worker',
    port: env.RENDER_WORKER_HEALTH_PORT,
    checks: [() => checkRedisHealth(connection)],
    logger,
  });
  logger.info({ port: healthServer.port }, 'health-сервер запущено');

  const processor = createRenderJobProcessor(logger);
  // Рендеринг ресурсоємний: концюренсі свідомо 1 до появи реальних render-джобів.
  const worker = new Worker(QUEUES.render, (job) => processor(job), {
    connection,
    concurrency: 1,
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

  const renderQueue = new Queue(QUEUES.render, { connection });
  // Queue тримає власне duplicated-зʼєднання: без listener-а помилки
  // друкуються в stderr повз структурований лог.
  renderQueue.on('error', (error) => {
    logger.warn({ err: error.message }, 'queue error');
  });
  await renderQueue.upsertJobScheduler(
    'render-worker-heartbeat',
    { every: HEARTBEAT_INTERVAL_MS },
    { name: JOBS.systemHeartbeat, data: { source: 'render-worker' } },
  );

  logger.info(
    { queue: QUEUES.render, heartbeatEveryMs: HEARTBEAT_INTERVAL_MS },
    'render-worker готовий',
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'зупинка render-worker-а');
    await worker.close();
    await renderQueue.close();
    await healthServer.close();
    connection.disconnect();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
  process.stderr.write(`render-worker не зміг стартувати: ${message}\n`);
  process.exit(1);
});
