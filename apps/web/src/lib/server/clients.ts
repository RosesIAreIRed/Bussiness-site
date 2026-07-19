import { createPrismaClient, type PrismaClient } from '@ormilo/db';
import type { Env } from '@ormilo/config';

/**
 * PrismaClient кешується у globalThis, щоб hot reload у dev
 * не плодив пул зʼєднань. Створення lazy — на першому запиті,
 * а не під час build.
 */
const globalCache = globalThis as unknown as { __ormiloPrisma?: PrismaClient };

export function getPrismaClient(env: Env): PrismaClient {
  globalCache.__ormiloPrisma ??= createPrismaClient({ databaseUrl: env.DATABASE_URL });
  return globalCache.__ormiloPrisma;
}
