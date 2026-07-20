import { describe, expect, it } from 'vitest';
import { CandidateAnalysisService } from '../src/research/analysis-service.js';
import type {
  AnalysisDeps,
  SchemaLike,
  StructuredTextGenerator,
} from '../src/research/analysis-service.js';
import { CandidateService } from '../src/core/candidate-service.js';
import type { Actor } from '../src/core/types.js';
import type { CandidateAssessment, ProductBrief } from '../src/research/types.js';
import { createFakeState, createFakeUow, type FakeState } from './fakes.js';

const operator: Actor = { userId: 'user-1', role: 'OPERATOR' };

const passthrough = <T>(): SchemaLike<T> => ({ parse: (value) => value as T });

function makeBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    summary: 'Портативний блендер: смузі за 30 секунд будь-де.',
    targetPersonas: [
      { name: 'Фітнес-ентузіастка', pains: ['брак часу'], desires: ['здорові звички'], objections: ['чи потужний?'] },
    ],
    benefits: [{ benefit: 'Заряд на 15 смузі', evidence: null, confidence: 0.7 }],
    angles: [
      { name: 'Problem → Solution', rationale: 'ранковий поспіх', hooks: ['Смузі швидше, ніж кава'] },
    ],
    riskyClaims: [],
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<CandidateAssessment> = {}): CandidateAssessment {
  return {
    whyItCanSell: ['візуальна демонстрація'],
    whyItCanFail: ['насичений ринок'],
    recommendedOffer: '2 за ціною 1 + безкоштовна доставка',
    missingMaterials: ['відео розпакування'],
    ratings: {
      visualDemoPotential: 0.95,
      landingPageQuality: 0.8,
      offerStrength: 0.85,
      fulfillmentQuality: 0.8,
      trustAndReviews: 0.7,
      differentiation: 0.8,
    },
    penalties: {
      policyRisk: 0.05,
      copyrightRisk: 0,
      fragileOrExpensiveShipping: 0.1,
      unrealisticClaims: 0.05,
      weakSupplierReliability: 0.1,
      saturatedCommodity: 0.2,
    },
    ...overrides,
  };
}

function makeDeps(
  brief: ProductBrief = makeBrief(),
  assessment: CandidateAssessment = makeAssessment(),
): AnalysisDeps {
  const generator: StructuredTextGenerator = {
    generateStructured: async ({ systemPrompt, schema }) => {
      if (systemPrompt.includes('product-brief')) return schema.parse(brief);
      if (systemPrompt.includes('candidate-assessment')) return schema.parse(assessment);
      throw new Error(`тест: невідомий prompt: ${systemPrompt}`);
    },
  };
  return {
    textGenerator: generator,
    prompts: {
      brief: {
        key: 'product-brief',
        version: 1,
        systemPrompt: '[prompt:product-brief@v1]',
        buildUserPrompt: (vars) => `Назва: ${vars.title}`,
      },
      assessment: {
        key: 'candidate-assessment',
        version: 1,
        systemPrompt: '[prompt:candidate-assessment@v1]',
        buildUserPrompt: (vars) => `Назва: ${vars.title}`,
      },
    },
    schemas: { brief: passthrough<ProductBrief>(), assessment: passthrough<CandidateAssessment>() },
    now: () => new Date('2026-07-19T12:00:00Z'),
  };
}

async function createCandidate(state: FakeState, rawData?: Record<string, unknown>) {
  const service = new CandidateService(createFakeUow(state));
  return service.createManual(
    { sourceType: 'MANUAL', title: 'Портативний блендер', rawData },
    operator,
  );
}

describe('CandidateAnalysisService', () => {
  it('requestAnalysis ставить ANALYZING, пише audit і подію; idempotent', async () => {
    const state = createFakeState();
    const candidate = await createCandidate(state);
    const service = new CandidateAnalysisService(createFakeUow(state));

    const updated = await service.requestAnalysis(candidate.id, operator);
    expect(updated.status).toBe('ANALYZING');

    const again = await service.requestAnalysis(candidate.id, operator);
    expect(again.status).toBe('ANALYZING');

    expect(state.outbox.filter((e) => e.type === 'ProductAnalysisRequested')).toHaveLength(1);
    expect(state.audit.some((e) => e.action === 'candidate.analysis-requested')).toBe(true);
  });

  it('runAnalysis: повний результат, статус TEST для сильного кандидата з маржею', async () => {
    const state = createFakeState();
    const candidate = await createCandidate(state, {
      price: '29.99',
      cost: 6,
      shipping: 2,
      days_running: 60,
      creativeCount: 10,
    });
    const service = new CandidateAnalysisService(createFakeUow(state));

    const result = await service.runAnalysis(candidate.id, makeDeps());

    expect(result.normalized.sellingPrice).toBe(29.99);
    expect(result.pricing).not.toBeNull();
    expect(result.sellingEconomics).not.toBeNull();
    expect(result.compliance.status).toBe('PASS');
    expect(result.score.total).toBeGreaterThanOrEqual(75);
    expect(result.score.autoDecision).toBe('TEST');
    expect(result.prompts).toEqual([
      { key: 'product-brief', version: 1 },
      { key: 'candidate-assessment', version: 1 },
    ]);

    const stored = state.candidates[0]!;
    expect(stored.status).toBe('TEST');
    expect(stored.decision).toBe('TEST');
    expect(stored.score).toBe(result.score.total);
    expect(stored.normalizedData).toEqual(result);

    expect(state.audit.some((e) => e.action === 'candidate.analyzed')).toBe(true);
    const completed = state.outbox.find((e) => e.type === 'ProductAnalysisCompleted');
    expect(completed?.payload).toMatchObject({ candidateId: candidate.id, decision: 'TEST' });
  });

  it('без даних про собівартість pricing відсутній, маржа не оцінюється', async () => {
    const state = createFakeState();
    const candidate = await createCandidate(state);
    const service = new CandidateAnalysisService(createFakeUow(state));

    const result = await service.runAnalysis(candidate.id, makeDeps());

    expect(result.pricing).toBeNull();
    expect(result.sellingEconomics).toBeNull();
    const marginFactor = result.score.factors.find((f) => f.key === 'grossMargin')!;
    expect(marginFactor.score).toBe(0);
  });

  it('BLOCKED compliance піднімає unrealisticClaims до критичного і валить рішення', async () => {
    const state = createFakeState();
    const candidate = await createCandidate(state, { cost: 6, price: 30 });
    const service = new CandidateAnalysisService(createFakeUow(state));

    const brief = makeBrief({ summary: 'Гарантований результат за тиждень: лікує безсоння.' });
    const result = await service.runAnalysis(candidate.id, makeDeps(brief));

    expect(result.compliance.status).toBe('BLOCKED');
    expect(result.assessment.penalties.unrealisticClaims).toBeGreaterThanOrEqual(0.9);
    expect(result.score.autoDecision).toBe('REJECT');
    expect(state.candidates[0]!.status).toBe('REJECTED');
  });

  it('неіснуючий кандидат → CandidateNotFoundError', async () => {
    const service = new CandidateAnalysisService(createFakeUow(createFakeState()));
    await expect(service.runAnalysis('missing', makeDeps())).rejects.toThrow('не знайдено');
  });
});
