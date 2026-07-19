import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AiOutputValidationError, parseStructuredOutput } from '../src/ai/validation.js';

const briefSchema = z.object({
  title: z.string().min(1),
  hooks: z.array(z.string()).min(1),
});

describe('parseStructuredOutput', () => {
  it('повертає типізовані дані для валідного output', () => {
    const parsed = parseStructuredOutput(
      briefSchema,
      { title: 'Козирок від сонця', hooks: ['Хук 1'] },
      'product-brief',
    );

    expect(parsed.title).toBe('Козирок від сонця');
    expect(parsed.hooks).toHaveLength(1);
  });

  it('кидає AiOutputValidationError з переліком проблем', () => {
    expect(() => parseStructuredOutput(briefSchema, { title: '', hooks: [] }, 'product-brief')).toThrow(
      AiOutputValidationError,
    );

    try {
      parseStructuredOutput(briefSchema, { hooks: 'not-array' }, 'product-brief');
    } catch (error) {
      const validationError = error as AiOutputValidationError;
      expect(validationError.context).toBe('product-brief');
      expect(validationError.issues.length).toBeGreaterThan(0);
      expect(validationError.message).toContain('product-brief');
    }
  });

  it('відхиляє null/undefined output', () => {
    expect(() => parseStructuredOutput(briefSchema, null, 'ctx')).toThrow(AiOutputValidationError);
    expect(() => parseStructuredOutput(briefSchema, undefined, 'ctx')).toThrow(
      AiOutputValidationError,
    );
  });
});
