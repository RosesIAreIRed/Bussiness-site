import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '@ormilo/config';
import { JOBS, QUEUES } from '@ormilo/contracts';
import { checkRedisHealth, createLogger, startHealthServer } from '@ormilo/observability';
import { createSystemJobProcessor } from './processor.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

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

  // Health-сервер стартує до підключення черг: якщо Redis лежить,
  // /health чесно віддасть 503 замість того, щоб процес завис без діагностики.
  const healthServer = await startHealthServer({
    service: 'worker',
    port: env.WORKER_HEALTH_PORT,
    checks: [() => checkRedisHealth(connection)],
    logger,
  });
  logger.info({ port: healthServer.port }, 'health-сервер запущено');

  const processor = createSystemJobProcessor(logger);
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

  // Repeatable heartbeat через job scheduler: upsert — idempotent,
  // повторний старт worker-а не створює дублікатів.
  const systemQueue = new Queue(QUEUES.system, { connection });
  // Queue тримає власне duplicated-зʼєднання: без listener-а помилки
  // друкуються в stderr повз структурований лог.
  systemQueue.on('error', (error) => {
    logger.warn({ err: error.message }, 'queue error');
  });
  await systemQueue.upsertJobScheduler(
    'worker-heartbeat',
    { every: HEARTBEAT_INTERVAL_MS },
    { name: JOBS.systemHeartbeat, data: { source: 'worker' } },
  );

  logger.info({ queue: QUEUES.system, heartbeatEveryMs: HEARTBEAT_INTERVAL_MS }, 'worker готовий');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'зупинка worker-а');
    await worker.close();
    await systemQueue.close();
    await healthServer.close();
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
