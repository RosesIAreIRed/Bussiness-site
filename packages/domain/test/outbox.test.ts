import { describe, expect, it } from 'vitest';
import {
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_MAX_DELAY_MS,
  computeOutboxBackoffMs,
  isOutboxExhausted,
} from '../src/core/outbox.js';

describe('outbox backoff policy', () => {
  it('зростає експоненційно з обмеженням зверху', () => {
    expect(computeOutboxBackoffMs(0)).toBe(1_000);
    expect(computeOutboxBackoffMs(1)).toBe(2_000);
    expect(computeOutboxBackoffMs(3)).toBe(8_000);
    expect(computeOutboxBackoffMs(20)).toBe(OUTBOX_MAX_DELAY_MS);
    expect(computeOutboxBackoffMs(-5)).toBe(1_000);
  });

  it('визначає вичерпання спроб', () => {
    expect(isOutboxExhausted(OUTBOX_MAX_ATTEMPTS - 1)).toBe(false);
    expect(isOutboxExhausted(OUTBOX_MAX_ATTEMPTS)).toBe(true);
  });
});
