import { afterEach, describe, expect, it } from 'vitest';
import { healthReportSchema } from '@ormilo/contracts';
import { runComponentCheck } from '../src/health.js';
import { startHealthServer, type RunningHealthServer } from '../src/health-server.js';

let running: RunningHealthServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe('startHealthServer', () => {
  it('віддає 200 і валідний HealthReport, коли всі перевірки ok', async () => {
    running = await startHealthServer({
      service: 'worker',
      port: 0,
      host: '127.0.0.1',
      checks: [() => runComponentCheck('redis', () => Promise.resolve())],
    });

    const response = await fetch(`http://127.0.0.1:${running.port}/health`);
    expect(response.status).toBe(200);

    const report = healthReportSchema.parse(await response.json());
    expect(report.service).toBe('worker');
    expect(report.status).toBe('ok');
  });

  it('віддає 503, коли компонент у стані error', async () => {
    running = await startHealthServer({
      service: 'worker',
      port: 0,
      host: '127.0.0.1',
      checks: [() => runComponentCheck('redis', () => Promise.reject(new Error('down')))],
    });

    const response = await fetch(`http://127.0.0.1:${running.port}/health`);
    expect(response.status).toBe(503);

    const report = healthReportSchema.parse(await response.json());
    expect(report.status).toBe('degraded');
    expect(report.components[0]?.error).toBe('down');
  });

  it('віддає 404 для невідомих шляхів', async () => {
    running = await startHealthServer({
      service: 'worker',
      port: 0,
      host: '127.0.0.1',
      checks: [],
    });

    const response = await fetch(`http://127.0.0.1:${running.port}/unknown`);
    expect(response.status).toBe(404);
  });
});
