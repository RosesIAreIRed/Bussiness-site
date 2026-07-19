import type { ZodType } from 'zod';

/** AI повернув structured output, який не пройшов Zod-валідацію. */
export class AiOutputValidationError extends Error {
  readonly context: string;
  readonly issues: readonly string[];

  constructor(context: string, issues: string[]) {
    super(`AI output не пройшов валідацію (${context}):\n  - ${issues.join('\n  - ')}`);
    this.name = 'AiOutputValidationError';
    this.context = context;
    this.issues = issues;
  }
}

/**
 * Обовʼязкова точка проходження всіх AI structured outputs.
 * Повертає типізовані дані або кидає AiOutputValidationError
 * зі списком проблем (без сирих значень — щоб не тягти у логи потенційний PII).
 */
export function parseStructuredOutput<T>(schema: ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new AiOutputValidationError(context, issues);
  }
  return result.data;
}
