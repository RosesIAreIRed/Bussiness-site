import { describe, expect, it } from 'vitest';
import { makeTestEnv } from '@ormilo/test-utils';
import { EnvValidationError, parseEnv } from '../src/env.js';

describe('parseEnv', () => {
  it('парсить повний валідний env', () => {
    const env = parseEnv(makeTestEnv());

    expect(env.NODE_ENV).toBe('test');
    expect(env.WEB_PORT).toBe(3000);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.SHOPIFY_API_VERSION).toBe('2026-07');
  });

  it('застосовує development-дефолти для порожнього source', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.S3_BUCKET_ASSETS).toBe('ormilo-assets');
  });

  it('трактує порожній рядок як відсутнє значення (застосовує дефолт)', () => {
    const env = parseEnv({ LOG_LEVEL: '' });
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('коерсить числові порти з рядків', () => {
    const env = parseEnv(makeTestEnv({ WEB_PORT: '4100' }));
    expect(env.WEB_PORT).toBe(4100);
  });

  it('відхиляє невалідний порт із зрозумілою помилкою без значень секретів', () => {
    expect(() => parseEnv(makeTestEnv({ WORKER_HEALTH_PORT: 'not-a-port' }))).toThrow(
      EnvValidationError,
    );

    try {
      parseEnv(makeTestEnv({ WORKER_HEALTH_PORT: 'not-a-port' }));
    } catch (error) {
      const message = (error as EnvValidationError).message;
      expect(message).toContain('WORKER_HEALTH_PORT');
      expect(message).not.toContain('test-secret');
    }
  });

  it('відхиляє невалідну версію Shopify API', () => {
    expect(() => parseEnv(makeTestEnv({ SHOPIFY_API_VERSION: '2026-03' }))).toThrow(
      EnvValidationError,
    );
  });

  it('при APP_ENV=production вимагає явні значення критичних змінних', () => {
    expect(() => parseEnv({ APP_ENV: 'production' })).toThrow(EnvValidationError);

    try {
      parseEnv({ APP_ENV: 'production' });
    } catch (error) {
      const message = (error as EnvValidationError).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('S3_SECRET_ACCESS_KEY');
    }
  });

  it('NODE_ENV=production сам по собі НЕ вмикає production-guard (next start)', () => {
    // Next.js ставить NODE_ENV=production у `next build`/`next start` навіть локально;
    // деплой-обмеження керуються виключно APP_ENV.
    const env = parseEnv({ NODE_ENV: 'production' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.APP_ENV).toBe('development');
  });

  it('при APP_ENV=production приймає повний явний набір', () => {
    const env = parseEnv(makeTestEnv({ APP_ENV: 'production' }));
    expect(env.APP_ENV).toBe('production');
  });
});
