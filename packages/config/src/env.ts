import { z } from 'zod';

const portSchema = (defaultPort: number) =>
  z.coerce.number().int().min(1).max(65535).default(defaultPort);

const optionalSecret = z.string().min(1).optional();

/**
 * Схема environment-змінних усієї системи (ТЗ §24).
 * Дефолти відповідають local development через docker-compose.yml.
 * При APP_ENV=production дефолти заборонені для критичних змінних
 * (див. REQUIRED_IN_PRODUCTION).
 */
export const envSchema = z.object({
  /**
   * Runtime-режим фреймворків (Next.js сам ставить production у `next build/start`).
   * НЕ використовується для security-guard-ів — для цього є APP_ENV.
   */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Середовище деплою. Саме воно вмикає production-обмеження
   * (заборона дефолтних секретів, заборона supplier orders у dev тощо).
   */
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  APP_URL: z.url().default('http://localhost:3000'),
  WEB_PORT: portSchema(3000),
  WORKER_HEALTH_PORT: portSchema(3001),
  RENDER_WORKER_HEALTH_PORT: portSchema(3002),

  DATABASE_URL: z.url().default('postgresql://ormilo:ormilo@localhost:5432/ormilo'),
  REDIS_URL: z.url().default('redis://localhost:6379'),

  S3_ENDPOINT: z.url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('ormilo-assets'),
  S3_ACCESS_KEY: z.string().min(1).default('ormilo'),
  S3_SECRET_KEY: z.string().min(1).default('ormilo-dev-secret'),

  // --- Shopify (single store; підключається в Milestone 4) ---
  SHOPIFY_SHOP_DOMAIN: optionalSecret,
  SHOPIFY_ADMIN_ACCESS_TOKEN: optionalSecret,
  SHOPIFY_API_VERSION: z
    .string()
    .regex(/^\d{4}-(01|04|07|10)$/, 'Очікується формат Shopify API version, напр. 2026-07')
    .default('2026-07'),

  // --- AI providers (обираються окремо для text/image/video/TTS, ТЗ §3.2) ---
  TEXT_AI_PROVIDER: optionalSecret,
  TEXT_AI_API_KEY: optionalSecret,
  IMAGE_AI_PROVIDER: optionalSecret,
  IMAGE_AI_API_KEY: optionalSecret,
  VIDEO_AI_PROVIDER: optionalSecret,
  VIDEO_AI_API_KEY: optionalSecret,
  TTS_PROVIDER: optionalSecret,
  TTS_API_KEY: optionalSecret,

  // --- Meta Marketing API (optional milestone) ---
  META_APP_ID: optionalSecret,
  META_APP_SECRET: optionalSecret,
  META_ACCESS_TOKEN: optionalSecret,
  META_AD_ACCOUNT_ID: optionalSecret,

  // --- Security / observability ---
  /**
   * AES-256-GCM ключ шифрування tokens/PII at rest і підпису сесій:
   * 64 hex-символи (32 байти). Дефолт — ЛИШЕ для local development
   * (публічний у repo); при APP_ENV=production обовʼязково явне значення
   * (REQUIRED_IN_PRODUCTION).
   */
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, '64 hex-символи (32 байти), напр. з `openssl rand -hex 32`')
    .default('ad2f1c3f6a3f4b21a7c9d5e8f0b4a6c1d3e5f7a9b1c3d5e7f9a0b2c4d6e8f0a1'),
  WEBHOOK_SECRET: optionalSecret,
  SENTRY_DSN: optionalSecret,

  // --- Cost guardrails (ТЗ §18) ---
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(10),
  AI_CREATIVE_BATCH_BUDGET_USD: z.coerce.number().positive().default(3),
});

export type Env = z.infer<typeof envSchema>;

/** Змінні, які при APP_ENV=production мають бути задані явно (дефолт недопустимий). */
export const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'ENCRYPTION_KEY',
] as const;

/**
 * Помилка валідації env. Містить лише назви змінних і повідомлення,
 * ніколи — значення (щоб secrets не потрапляли в логи).
 */
export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: string[]) {
    super(`Невалідна конфігурація environment:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export type EnvSource = Record<string, string | undefined>;

/** Порожні рядки в env трактуються як відсутні значення. */
function normalizeSource(source: EnvSource): EnvSource {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value]),
  );
}

export function parseEnv(source: EnvSource): Env {
  const normalized = normalizeSource(source);
  const result = envSchema.safeParse(normalized);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }

  if (result.data.APP_ENV === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => normalized[key] === undefined);
    if (missing.length > 0) {
      throw new EnvValidationError(
        missing.map(
          (key) => `${key}: при APP_ENV=production значення має бути задане явно, без дефолту`,
        ),
      );
    }
  }

  return result.data;
}

let cached: Env | undefined;

/**
 * Завантажує та кешує env. Викликається на старті процесу (bootstrap),
 * а не під час build — щоб build не залежав від наявності секретів.
 */
export function loadEnv(source: EnvSource = process.env): Env {
  cached ??= parseEnv(source);
  return cached;
}

/** Скидання кешу — виключно для тестів. */
export function resetEnvCache(): void {
  cached = undefined;
}
