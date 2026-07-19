import type { ComponentHealth, HealthReport } from '@ormilo/contracts';

export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`"${label}" не відповів за ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/** Обмежує тривалість асинхронної операції; таймер завжди прибирається. */
export async function withTimeout<T>(
  run: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const DEFAULT_CHECK_TIMEOUT_MS = 800;

/**
 * Виконує перевірку компонента і завжди повертає ComponentHealth —
 * помилки перетворюються на status: "error" і не пробрасуються далі.
 */
export async function runComponentCheck(
  name: string,
  check: () => Promise<void>,
  timeoutMs: number = DEFAULT_CHECK_TIMEOUT_MS,
): Promise<ComponentHealth> {
  const startedAt = performance.now();
  try {
    await withTimeout(check, timeoutMs, name);
    return { name, status: 'ok', latencyMs: round(performance.now() - startedAt) };
  } catch (cause) {
    return {
      name,
      status: 'error',
      latencyMs: round(performance.now() - startedAt),
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export function buildHealthReport(service: string, components: ComponentHealth[]): HealthReport {
  return {
    service,
    status: components.every((component) => component.status === 'ok') ? 'ok' : 'degraded',
    uptimeSec: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    components,
  };
}

export type HealthCheck = () => Promise<ComponentHealth>;

export async function collectHealthReport(
  service: string,
  checks: readonly HealthCheck[],
): Promise<HealthReport> {
  const components = await Promise.all(checks.map((check) => check()));
  return buildHealthReport(service, components);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
