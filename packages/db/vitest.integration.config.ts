import { defineConfig } from 'vitest/config';

/** Інтеграційні тести проти реальної PostgreSQL (INTEGRATION=1 + DATABASE_URL). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test-integration/**/*.test.ts'],
    // БД одна — файли послідовно, без гонок за таблиці.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
