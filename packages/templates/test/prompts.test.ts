import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_ASSESSMENT_PROMPT_V1,
  PRODUCT_BRIEF_PROMPT_V1,
  getResearchPrompt,
} from '../src/prompts/research.js';

describe('research prompts (ТЗ §14)', () => {
  it('містять versioned-маркер і ключові правила', () => {
    expect(PRODUCT_BRIEF_PROMPT_V1.systemPrompt).toContain('[prompt:product-brief@v1]');
    expect(PRODUCT_BRIEF_PROMPT_V1.systemPrompt).toContain('не вигадуй');
    expect(CANDIDATE_ASSESSMENT_PROMPT_V1.systemPrompt).toContain(
      '[prompt:candidate-assessment@v1]',
    );
    expect(PRODUCT_BRIEF_PROMPT_V1.version).toBe(1);
  });

  it('buildUserPrompt підставляє змінні та не падає на відсутніх', () => {
    const prompt = PRODUCT_BRIEF_PROMPT_V1.buildUserPrompt({
      title: 'Блендер',
      sourceUrl: 'https://example.com',
      data: '{"raw":{}}',
    });
    expect(prompt).toContain('Назва товару: Блендер');
    expect(prompt).toContain('https://example.com');
    expect(prompt).toContain('{"raw":{}}');

    const empty = CANDIDATE_ASSESSMENT_PROMPT_V1.buildUserPrompt({});
    expect(empty).toContain('—');
  });

  it('getResearchPrompt повертає активні версії', () => {
    expect(getResearchPrompt('product-brief')).toBe(PRODUCT_BRIEF_PROMPT_V1);
    expect(getResearchPrompt('candidate-assessment')).toBe(CANDIDATE_ASSESSMENT_PROMPT_V1);
  });
});
