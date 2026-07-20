/**
 * Versioned prompts Product Intelligence (ТЗ §14).
 * Маркер [prompt:<key>@v<version>] у systemPrompt — для traceability
 * та маршрутизації mock-провайдера. Зміна тексту → нова версія (append-only).
 */

export interface ResearchPromptTemplate {
  key: string;
  version: number;
  systemPrompt: string;
  buildUserPrompt(vars: Record<string, string>): string;
}

export const PRODUCT_BRIEF_PROMPT_V1: ResearchPromptTemplate = {
  key: 'product-brief',
  version: 1,
  systemPrompt: [
    '[prompt:product-brief@v1]',
    'Ти — senior e-commerce стратег. Побудуй Product Intelligence Brief для товару-кандидата.',
    'Правила:',
    '- Використовуй ЛИШЕ надані дані; НІЧОГО не вигадуй (жодних claims, яких немає в source data).',
    '- Твердження без доказів занось у riskyClaims із поясненням і severity.',
    '- Жодних медичних claims і гарантій результату.',
    '- Відповідь — СТРОГО валідний JSON за заданою схемою, без коментарів.',
    '- Мова полів — українська.',
  ].join('\n'),
  buildUserPrompt: (vars) =>
    [
      `Назва товару: ${vars.title ?? '—'}`,
      `URL джерела: ${vars.sourceUrl ?? '—'}`,
      `URL постачальника: ${vars.supplierUrl ?? '—'}`,
      `Дані кандидата (raw + normalized JSON):`,
      vars.data ?? '{}',
    ].join('\n'),
};

export const CANDIDATE_ASSESSMENT_PROMPT_V1: ResearchPromptTemplate = {
  key: 'candidate-assessment',
  version: 1,
  systemPrompt: [
    '[prompt:candidate-assessment@v1]',
    'Ти — аналітик dropshipping-товарів. Оціни кандидата за факторами і ризиками.',
    'Правила:',
    '- ratings і penalties — числа 0..1 (0 = найгірше/немає ризику відповідно).',
    '- Оцінюй консервативно: без даних не завищуй.',
    '- Відповідь — СТРОГО валідний JSON за заданою схемою.',
    '- Мова полів — українська.',
  ].join('\n'),
  buildUserPrompt: (vars) =>
    [
      `Назва товару: ${vars.title ?? '—'}`,
      `Стислий бриф: ${vars.briefSummary ?? '—'}`,
      `Дані кандидата (raw + normalized JSON):`,
      vars.data ?? '{}',
    ].join('\n'),
};

const ACTIVE_RESEARCH_PROMPTS = {
  'product-brief': PRODUCT_BRIEF_PROMPT_V1,
  'candidate-assessment': CANDIDATE_ASSESSMENT_PROMPT_V1,
} as const;

export type ResearchPromptKey = keyof typeof ACTIVE_RESEARCH_PROMPTS;

export function getResearchPrompt(key: ResearchPromptKey): ResearchPromptTemplate {
  return ACTIVE_RESEARCH_PROMPTS[key];
}
