import { describe, expect, it } from 'vitest';
import { JOBS } from '@ormilo/contracts';
import { UnknownJobTypeError } from '@ormilo/domain';
import { createLogger } from '@ormilo/observability';
import { createRenderJobProcessor } from '../src/processor.js';

const silentLogger = createLogger({
  service: 'test',
  level: 'error',
  destination: { write: () => undefined },
});

describe('createRenderJobProcessor', () => {
  it('обробляє heartbeat', async () => {
    const processor = createRenderJobProcessor(silentLogger);

    const result = await processor({
      name: JOBS.systemHeartbeat,
      data: { source: 'render-worker' },
    });

    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it('кидає UnknownJobTypeError для render-джобів, які ще не реалізовані', async () => {
    const processor = createRenderJobProcessor(silentLogger);

    try {
      await processor({ name: 'creative.renderVideo', data: { batchId: 'b1' } });
      expect.unreachable('очікувалась помилка');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownJobTypeError);
      expect((error as UnknownJobTypeError).details).toMatchObject({
        queue: 'render',
        jobName: 'creative.renderVideo',
      });
    }
  });
});
