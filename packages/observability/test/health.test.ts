import { describe, expect, it } from 'vitest';
import { healthReportSchema } from '@ormilo/contracts';
import {
  buildHealthReport,
  collectHealthReport,
  runComponentCheck,
  TimeoutError,
  withTimeout,
} from '../src/health.js';

describe('withTimeout', () => {
  it('повертає результат, якщо операція встигла', async () => {
    await expect(withTimeout(() => Promise.resolve(42), 100, 'fast')).resolves.toBe(42);
  });

  it('кидає TimeoutError, якщо операція зависла', async () => {
    const never = () => new Promise<void>(() => {});
    await expect(withTimeout(never, 20, 'stuck')).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('runComponentCheck', () => {
  it('повертає ok з latency для успішної перевірки', async () => {
    const component = await runComponentCheck('database', () => Promise.resolve());

    expect(component.status).toBe('ok');
    expect(component.latencyMs).toBeGreaterThanOrEqual(0);
    expect(component.error).toBeUndefined();
  });

  it('перетворює помилку на status=error, не кидаючи її', async () => {
    const component = await runComponentCheck('redis', () =>
      Promise.reject(new Error('connection refused')),
    );

    expect(component.status).toBe('error');
    expect(component.error).toBe('connection refused');
  });

  it('перетворює таймаут на status=error', async () => {
    const component = await runComponentCheck('slow', () => new Promise(() => {}), 20);

    expect(component.status).toBe('error');
    expect(component.error).toContain('20ms');
  });
});

describe('buildHealthReport / collectHealthReport', () => {
  it('статус ok лише коли всі компоненти ok', () => {
    const okReport = buildHealthReport('web', [
      { name: 'database', status: 'ok', latencyMs: 1 },
      { name: 'redis', status: 'ok', latencyMs: 1 },
    ]);
    expect(okReport.status).toBe('ok');

    const degraded = buildHealthReport('web', [
      { name: 'database', status: 'ok', latencyMs: 1 },
      { name: 'redis', status: 'error', latencyMs: 800, error: 'timeout' },
    ]);
    expect(degraded.status).toBe('degraded');
  });

  it('звіт відповідає контракту healthReportSchema', async () => {
    const report = await collectHealthReport('worker', [
      () => runComponentCheck('a', () => Promise.resolve()),
      () => runComponentCheck('b', () => Promise.reject(new Error('boom'))),
    ]);

    const parsed = healthReportSchema.parse(report);
    expect(parsed.service).toBe('worker');
    expect(parsed.status).toBe('degraded');
    expect(parsed.components).toHaveLength(2);
  });
});
