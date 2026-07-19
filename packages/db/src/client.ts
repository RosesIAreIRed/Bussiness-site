import { PrismaClient } from '@prisma/client';

export interface CreatePrismaClientOptions {
  databaseUrl: string;
  /** Рівні логування Prisma; за замовчуванням лише warn/error. */
  log?: ReadonlyArray<'query' | 'info' | 'warn' | 'error'>;
}

/**
 * Фабрика PrismaClient. URL передається явно (з validated env),
 * щоб клієнт ніколи не читав process.env напряму.
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  return new PrismaClient({
    datasourceUrl: options.databaseUrl,
    log: [...(options.log ?? ['warn', 'error'])],
  });
}
