import type { ComponentHealth } from '@ormilo/contracts';
import { runComponentCheck } from './health.js';

/** Мінімальний інтерфейс Redis-клієнта (сумісний з ioredis). */
export interface Pingable {
  ping(): Promise<string>;
}

export function checkRedisHealth(client: Pingable, timeoutMs?: number): Promise<ComponentHealth> {
  return runComponentCheck(
    'redis',
    async () => {
      const reply = await client.ping();
      if (reply !== 'PONG') {
        throw new Error(`неочікувана відповідь на PING: ${reply}`);
      }
    },
    timeoutMs,
  );
}

/** Мінімальний інтерфейс клієнта БД (сумісний з PrismaClient.$queryRaw). */
export interface RawQueryable {
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

export function checkDatabaseHealth(
  db: RawQueryable,
  timeoutMs?: number,
): Promise<ComponentHealth> {
  return runComponentCheck(
    'database',
    async () => {
      await db.$queryRaw`SELECT 1`;
    },
    timeoutMs,
  );
}
