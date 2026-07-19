/**
 * Повний валідний набір env-змінних для тестів.
 * Містить явні значення для всіх змінних, обовʼязкових у production,
 * тому придатний і для перевірки production-режиму конфігурації.
 */
export function makeTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    LOG_LEVEL: 'error',
    APP_URL: 'http://localhost:3000',
    WEB_PORT: '3000',
    WORKER_HEALTH_PORT: '3001',
    RENDER_WORKER_HEALTH_PORT: '3002',
    DATABASE_URL: 'postgresql://ormilo:ormilo@localhost:5432/ormilo_test',
    REDIS_URL: 'redis://localhost:6379/1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'test-assets',
    S3_ACCESS_KEY: 'test-access',
    S3_SECRET_KEY: 'test-secret',
    SHOPIFY_API_VERSION: '2026-07',
    // 32 байти → 64 hex-символи (тестовий, не для реального використання)
    ENCRYPTION_KEY: 'a'.repeat(64),
    ...overrides,
  };
}
