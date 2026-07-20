import { describe, expect, it } from 'vitest';
import { candidateAssessmentSchema, productBriefSchema } from '@ormilo/contracts';
import { getResearchPrompt } from '@ormilo/templates';
import { MockResponderMissingError } from '../src/ai/mock-text-provider.js';
import { createTextGenerationProvider } from '../src/ai/research-mock.js';

const provider = createTextGenerationProvider({ provider: 'mock' });
const briefPrompt = getResearchPrompt('product-brief');
const assessmentPrompt = getResearchPrompt('candidate-assessment');

describe('research mock provider (ТЗ §26 п.7)', () => {
  it('генерує brief, що проходить реальну Zod-схему контракту', async () => {
    const brief = await provider.generateStructured({
      systemPrompt: briefPrompt.systemPrompt,
      userPrompt: briefPrompt.buildUserPrompt({ title: 'Портативний блендер', data: '{}' }),
      schema: productBriefSchema,
    });

    expect(brief.summary).toContain('Портативний блендер');
    expect(brief.angles.length).toBeGreaterThanOrEqual(3);
    expect(brief.angles.flatMap((angle) => angle.hooks).length).toBeGreaterThanOrEqual(12);
  });

  it('генерує assessment із ratings/penalties у межах 0..1', async () => {
    const assessment = await provider.generateStructured({
      systemPrompt: assessmentPrompt.systemPrompt,
      userPrompt: assessmentPrompt.buildUserPrompt({ title: 'Лампа-проєктор', data: '{}' }),
      schema: candidateAssessmentSchema,
    });

    for (const value of Object.values(assessment.ratings)) {
      expect(value).toBeGreaterThanOrEqual(0.6);
      expect(value).toBeLessThan(0.9);
    }
    for (const value of Object.values(assessment.penalties)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0.15);
    }
  });

  it('детермінований: однаковий вхід → однаковий вихід; різні товари → різні оцінки', async () => {
    const run = (title: string) =>
      provider.generateStructured({
        systemPrompt: assessmentPrompt.systemPrompt,
        userPrompt: assessmentPrompt.buildUserPrompt({ title, data: '{}' }),
        schema: candidateAssessmentSchema,
      });

    const first = await run('Товар А');
    const second = await run('Товар А');
    const other = await run('Зовсім інший товар Б');

    expect(first).toEqual(second);
    expect(first.ratings).not.toEqual(other.ratings);
  });

  it('невідомий prompt → зрозуміла помилка, невідомий провайдер → помилка фабрики', async () => {
    await expect(
      provider.generateStructured({
        systemPrompt: 'random prompt',
        userPrompt: 'x',
        schema: productBriefSchema,
      }),
    ).rejects.toBeInstanceOf(MockResponderMissingError);

    expect(() => createTextGenerationProvider({ provider: 'openai' })).toThrow(
      'не підтримується',
    );
  });
});
