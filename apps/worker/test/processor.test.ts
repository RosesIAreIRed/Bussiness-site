import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { JOBS } from '@ormilo/contracts';
import { UnknownJobTypeError } from '@ormilo/domain';
import { createLogger } from '@ormilo/observability';
import { createSystemJobProcessor } from '../src/processor.js';

const silentLogger = createLogger({
  service: 'test',
  level: 'error',
  destination: { write: () => undefined },
});

describe('createSystemJobProcessor', () => {
  it('обробляє heartbeat і повертає ISO-час обробки', async () => {
    const processor = createSystemJobProcessor(silentLogger);

    const result = await processor({
      name: JOBS.systemHeartbeat,
      id: 'job-1',
      data: { source: 'worker' },
    });

    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it('відхиляє heartbeat з невалідним payload (Zod)', async () => {
    const processor = createSystemJobProcessor(silentLogger);

    await expect(
      processor({ name: JOBS.systemHeartbeat, data: { source: '' } }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(processor({ name: JOBS.systemHeartbeat, data: null })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('кидає UnknownJobTypeError для незареєстрованого job-типу', async () => {
    const processor = createSystemJobProcessor(silentLogger);

    await expect(processor({ name: 'creative.render', data: {} })).rejects.toBeInstanceOf(
      UnknownJobTypeError,
    );
  });
});
