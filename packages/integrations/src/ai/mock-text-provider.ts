import type { StructuredGenerationInput, TextGenerationProvider } from './providers.js';

export interface MockResponder {
  /** Чи відповідає цей responder за prompt (зазвичай за versioned-маркером). */
  matches(input: { systemPrompt: string; userPrompt: string }): boolean;
  build(input: { systemPrompt: string; userPrompt: string }): unknown;
}

export class MockResponderMissingError extends Error {
  constructor(systemPrompt: string) {
    super(
      `MockTextGenerationProvider: немає responder-а для prompt. ` +
        `Початок systemPrompt: "${systemPrompt.slice(0, 80)}…"`,
    );
    this.name = 'MockResponderMissingError';
  }
}

/**
 * Mock TextGenerationProvider (ТЗ §26 п.7: mocked adapters до real credentials).
 * Детермінований; output ЗАВЖДИ проходить через schema.parse — контракт
 * structured JSON перевіряється так само, як для реального провайдера.
 */
export class MockTextGenerationProvider implements TextGenerationProvider {
  constructor(private readonly responders: readonly MockResponder[]) {}

  async generateStructured<T>(input: StructuredGenerationInput<T>): Promise<T> {
    const responder = this.responders.find((candidate) =>
      candidate.matches({ systemPrompt: input.systemPrompt, userPrompt: input.userPrompt }),
    );
    if (!responder) {
      throw new MockResponderMissingError(input.systemPrompt);
    }
    const raw = responder.build({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    });
    return input.schema.parse(raw);
  }
}
