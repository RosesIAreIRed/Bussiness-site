import { NextResponse } from 'next/server';
import { Redis } from 'ioredis';
import { loadEnv } from '@ormilo/config';
import { buildHealthReport, checkDatabaseHealth, runComponentCheck } from '@ormilo/observability';
import { getPrismaClient } from '../../../lib/server/clients';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Разове підключення до Redis на перевірку: web не тримає постійного
 * зʼєднання з чергами (це роль worker-ів), тому ping робиться ephemeral-клієнтом.
 */
function checkRedisOnce(redisUrl: string) {
  return runComponentCheck(
    'redis',
    async () => {
      const redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 500,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      // Помилку зʼєднання повертає connect()/ping(); без listener-а ioredis
      // додатково друкує "Unhandled error event" у stderr.
      redis.on('error', () => undefined);
      try {
        await redis.connect();
        const reply = await redis.ping();
        if (reply !== 'PONG') {
          throw new Error(`неочікувана відповідь на PING: ${reply}`);
        }
      } finally {
        redis.disconnect();
      }
    },
    900,
  );
}

export async function GET(): Promise<NextResponse> {
  const env = loadEnv();

  const [database, redis] = await Promise.all([
    checkDatabaseHealth(getPrismaClient(env), 900),
    checkRedisOnce(env.REDIS_URL),
  ]);

  const report = buildHealthReport('web', [database, redis]);
  return NextResponse.json(report, { status: report.status === 'ok' ? 200 : 503 });
}
