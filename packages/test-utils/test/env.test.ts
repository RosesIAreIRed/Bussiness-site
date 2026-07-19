import { describe, expect, it } from 'vitest';
import { makeTestEnv } from '../src/env.js';

describe('makeTestEnv', () => {
  it('повертає повний набір змінних', () => {
    const env = makeTestEnv();

    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.REDIS_URL).toBeDefined();
    expect(env.S3_SECRET_ACCESS_KEY).toBeDefined();
    expect(env.SHOPIFY_API_VERSION).toBe('2026-07');
  });

  it('застосовує overrides поверх дефолтів', () => {
    const env = makeTestEnv({ NODE_ENV: 'production', WEB_PORT: '8080' });

    expect(env.NODE_ENV).toBe('production');
    expect(env.WEB_PORT).toBe('8080');
    expect(env.REDIS_URL).toBe('redis://localhost:6379/1');
  });

  it('не мутує спільний стан між викликами', () => {
    const first = makeTestEnv({ LOG_LEVEL: 'trace' });
    const second = makeTestEnv();

    expect(first.LOG_LEVEL).toBe('trace');
    expect(second.LOG_LEVEL).toBe('error');
  });
});
