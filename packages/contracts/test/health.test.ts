import { describe, expect, it } from 'vitest';
import { componentHealthSchema, healthReportSchema } from '../src/health.js';

describe('componentHealthSchema', () => {
  it('приймає валідний ok-компонент', () => {
    const parsed = componentHealthSchema.parse({
      name: 'database',
      status: 'ok',
      latencyMs: 12.5,
    });
    expect(parsed.error).toBeUndefined();
  });

  it('приймає error-компонент з повідомленням', () => {
    const parsed = componentHealthSchema.parse({
      name: 'redis',
      status: 'error',
      latencyMs: 800,
      error: 'timeout',
    });
    expect(parsed.status).toBe('error');
  });

  it('відхиляє відʼємну latency та невідомий статус', () => {
    expect(() =>
      componentHealthSchema.parse({ name: 'db', status: 'ok', latencyMs: -1 }),
    ).toThrow();
    expect(() =>
      componentHealthSchema.parse({ name: 'db', status: 'meh', latencyMs: 1 }),
    ).toThrow();
  });
});

describe('healthReportSchema', () => {
  it('приймає повний валідний звіт', () => {
    const parsed = healthReportSchema.parse({
      service: 'web',
      status: 'degraded',
      uptimeSec: 42,
      checkedAt: new Date().toISOString(),
      components: [
        { name: 'database', status: 'ok', latencyMs: 3 },
        { name: 'redis', status: 'error', latencyMs: 800, error: 'timeout' },
      ],
    });
    expect(parsed.components).toHaveLength(2);
  });

  it('відхиляє не-ISO checkedAt', () => {
    expect(() =>
      healthReportSchema.parse({
        service: 'web',
        status: 'ok',
        uptimeSec: 1,
        checkedAt: '19.07.2026 12:00',
        components: [],
      }),
    ).toThrow();
  });
});
