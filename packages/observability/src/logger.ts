import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'cookie',
  'sessionToken',
  'clientSecret',
  'privateKey',
  'shippingAddress',
  'email',
  'phone',
] as const;

/**
 * Шляхи, які pino маскує у логах: top-level і один рівень вкладеності.
 * Персональні дані клієнтів (email, phone, shippingAddress) маскуються так само,
 * як і секрети інтеграцій.
 */
export const SENSITIVE_LOG_PATHS: readonly string[] = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  'req.headers.authorization',
  'req.headers.cookie',
];

export interface CreateLoggerOptions {
  /** Назва сервісу (web / worker / render-worker) — потрапляє в кожен запис. */
  service: string;
  level?: string;
  /** Людиночитаний вивід для local development. */
  pretty?: boolean;
  /** Кастомний destination — використовується у тестах. */
  destination?: DestinationStream;
}

export type { Logger } from 'pino';

export function createLogger(options: CreateLoggerOptions): Logger {
  const baseOptions: LoggerOptions = {
    level: options.level ?? 'info',
    base: { service: options.service },
    redact: { paths: [...SENSITIVE_LOG_PATHS], censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (options.destination) {
    return pino(baseOptions, options.destination);
  }

  if (options.pretty) {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      },
    });
  }

  return pino(baseOptions);
}
