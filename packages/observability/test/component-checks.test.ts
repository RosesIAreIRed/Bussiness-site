import { describe, expect, it } from 'vitest';
import { checkDatabaseHealth, checkRedisHealth } from '../src/component-checks.js';

describe('checkRedisHealth', () => {
  it('ok при відповіді PONG', async () => {
    const component = await checkRedisHealth({ ping: () => Promise.resolve('PONG') });
    expect(component).toMatchObject({ name: 'redis', status: 'ok' });
  });

  it('error при неочікуваній відповіді', async () => {
    const component = await checkRedisHealth({ ping: () => Promise.resolve('NOPE') });
    expect(component.status).toBe('error');
    expect(component.error).toContain('NOPE');
  });

  it('error при відмові зʼєднання', async () => {
    const component = await checkRedisHealth({
      ping: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    expect(component.status).toBe('error');
    expect(component.error).toBe('ECONNREFUSED');
  });
});

describe('checkDatabaseHealth', () => {
  it('ok коли SELECT 1 виконується', async () => {
    const component = await checkDatabaseHealth({
      $queryRaw: () => Promise.resolve([{ '?column?': 1 }]),
    });
    expect(component).toMatchObject({ name: 'database', status: 'ok' });
  });

  it('error коли запит падає', async () => {
    const component = await checkDatabaseHealth({
      $queryRaw: () => Promise.reject(new Error("Can't reach database server")),
    });
    expect(component.status).toBe('error');
    expect(component.error).toContain('database server');
  });
});
