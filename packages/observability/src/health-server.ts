import { createServer, type Server } from 'node:http';
import { collectHealthReport, type HealthCheck } from './health.js';
import type { Logger } from 'pino';

export interface HealthServerOptions {
  service: string;
  port: number;
  host?: string;
  checks: readonly HealthCheck[];
  logger?: Logger;
}

export interface RunningHealthServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

/**
 * Мінімальний HTTP-сервер health-check для background worker-ів.
 * GET /health → 200 (ok) або 503 (degraded) з JSON HealthReport.
 */
export async function startHealthServer(
  options: HealthServerOptions,
): Promise<RunningHealthServer> {
  const server = createServer((req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? '/', 'http://internal').pathname;

      if (req.method !== 'GET' || pathname !== '/health') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }

      const report = await collectHealthReport(options.service, options.checks);
      res.writeHead(report.status === 'ok' ? 200 : 503, {
        'content-type': 'application/json',
      });
      res.end(JSON.stringify(report));
    })().catch((cause: unknown) => {
      options.logger?.error(
        { err: cause instanceof Error ? cause.message : String(cause) },
        'health endpoint failed',
      );
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'internal error' }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host ?? '0.0.0.0', () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : options.port;

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
