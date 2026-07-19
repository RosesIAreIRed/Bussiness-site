import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/client.js';

describe('createPrismaClient', () => {
  it('створює клієнт без підключення до БД (lazy connect)', async () => {
    const client = createPrismaClient({
      databaseUrl: 'postgresql://user:password@localhost:5999/nonexistent',
    });

    expect(typeof client.$queryRaw).toBe('function');
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.systemHeartbeat.findMany).toBe('function');

    // Клієнт, що не підключався, закривається без помилок.
    await expect(client.$disconnect()).resolves.not.toThrow();
  });
});
