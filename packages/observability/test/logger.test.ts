import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';

function collectLogs(): { lines: string[]; destination: { write(msg: string): void } } {
  const lines: string[] = [];
  return { lines, destination: { write: (msg: string) => void lines.push(msg) } };
}

describe('createLogger', () => {
  it('маскує секрети на верхньому та вкладеному рівні', () => {
    const { lines, destination } = collectLogs();
    const logger = createLogger({ service: 'test', level: 'info', destination });

    logger.info(
      {
        token: 'super-secret-token',
        nested: { apiKey: 'secret-api-key', password: 'p@ss' },
        safe: 'visible-value',
      },
      'повідомлення',
    );

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;

    expect(record.token).toBe('[REDACTED]');
    expect((record.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((record.nested as Record<string, unknown>).password).toBe('[REDACTED]');
    expect(record.safe).toBe('visible-value');
    expect(lines[0]).not.toContain('super-secret-token');
    expect(lines[0]).not.toContain('secret-api-key');
  });

  it('маскує персональні дані клієнта (email, phone)', () => {
    const { lines, destination } = collectLogs();
    const logger = createLogger({ service: 'test', level: 'info', destination });

    logger.info({ customer: { email: 'client@example.com', phone: '+380961112233' } }, 'order');

    expect(lines[0]).not.toContain('client@example.com');
    expect(lines[0]).not.toContain('+380961112233');
  });

  it('додає service до кожного запису та поважає рівень логування', () => {
    const { lines, destination } = collectLogs();
    const logger = createLogger({ service: 'worker', level: 'warn', destination });

    logger.info('не має зʼявитися');
    logger.warn('має зʼявитися');

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(record.service).toBe('worker');
    expect(record.msg).toBe('має зʼявитися');
  });
});
