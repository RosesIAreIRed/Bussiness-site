import { describe, expect, it } from 'vitest';
import { createDomainEvent } from '../src/events.js';

describe('createDomainEvent', () => {
  it('створює подію з унікальним id, типом і ISO-часом', () => {
    const first = createDomainEvent('product.scored', { score: 72 });
    const second = createDomainEvent('product.scored', { score: 72 });

    expect(first.type).toBe('product.scored');
    expect(first.payload).toEqual({ score: 72 });
    expect(first.version).toBe(1);
    expect(first.id).not.toBe(second.id);
    expect(Number.isNaN(Date.parse(first.occurredAt))).toBe(false);
  });
});
