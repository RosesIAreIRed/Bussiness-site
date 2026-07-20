import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { JOBS } from '@ormilo/contracts';
import { UnknownJobTypeError, createDomainEvent } from '@ormilo/domain';
import { createLogger } from '@ormilo/observability';
import { createSystemJobProcessor } from '../src/processor.js';

const silentLogger = createLogger({
  service: 'test',
  level: 'error',
  destination: { write: () => undefined },
});

function makeProcessor(
  publishOutbox = vi.fn().mockResolvedValue({ published: 0, failed: 0 }),
  handleAnalysisRequested?: (candidateId: string) => Promise<void>,
) {
  return {
    processor: createSystemJobProcessor({
      logger: silentLogger,
      publishOutbox,
      handleAnalysisRequested,
    }),
    publishOutbox,
  };
}

describe('createSystemJobProcessor', () => {
  it('обробляє heartbeat і повертає ISO-час обробки', async () => {
    const { processor } = makeProcessor();

    const result = await processor({
      name: JOBS.systemHeartbeat,
      id: 'job-1',
      data: { source: 'worker' },
    });

    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it('відхиляє heartbeat з невалідним payload (Zod)', async () => {
    const { processor } = makeProcessor();

    await expect(
      processor({ name: JOBS.systemHeartbeat, data: { source: '' } }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('outbox.publish викликає publishOutbox і повертає лічильники', async () => {
    const { processor, publishOutbox } = makeProcessor(
      vi.fn().mockResolvedValue({ published: 3, failed: 1 }),
    );

    const result = await processor({ name: JOBS.outboxPublish, data: {} });

    expect(publishOutbox).toHaveBeenCalledOnce();
    expect(result.published).toBe(3);
    expect(result.failed).toBe(1);
  });

  it('обробляє відому domain event з валідним payload', async () => {
    const { processor } = makeProcessor();
    const envelope = createDomainEvent('ProductCandidateImported', {
      candidateId: crypto.randomUUID(),
    });

    const result = await processor({ name: JOBS.domainEvent, data: envelope });
    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it('падає на відомій події з невалідним payload (помилка продюсера)', async () => {
    const { processor } = makeProcessor();
    const envelope = createDomainEvent('ProductCandidateImported', { candidateId: 'not-a-uuid' });

    await expect(processor({ name: JOBS.domainEvent, data: envelope })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('ProductAnalysisRequested делегується analysis-обробнику', async () => {
    const handled: string[] = [];
    const { processor } = makeProcessor(undefined, async (candidateId) => {
      handled.push(candidateId);
    });
    const candidateId = crypto.randomUUID();
    const envelope = createDomainEvent('ProductAnalysisRequested', { candidateId });

    await processor({ name: JOBS.domainEvent, data: envelope });
    expect(handled).toEqual([candidateId]);
  });

  it('помилка analysis-обробника валить job (retry через BullMQ)', async () => {
    const { processor } = makeProcessor(undefined, async () => {
      throw new Error('провайдер недоступний');
    });
    const envelope = createDomainEvent('ProductAnalysisRequested', {
      candidateId: crypto.randomUUID(),
    });

    await expect(processor({ name: JOBS.domainEvent, data: envelope })).rejects.toThrow(
      'провайдер недоступний',
    );
  });

  it('підтверджує подію невідомого типу без обробки (forward-compat)', async () => {
    const { processor } = makeProcessor();
    const envelope = createDomainEvent('FutureEventType', { something: true });

    await expect(processor({ name: JOBS.domainEvent, data: envelope })).resolves.toBeDefined();
  });

  it('кидає UnknownJobTypeError для незареєстрованого job-типу', async () => {
    const { processor } = makeProcessor();

    await expect(processor({ name: 'creative.render', data: {} })).rejects.toBeInstanceOf(
      UnknownJobTypeError,
    );
  });
});
