import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  CandidateAnalysisService,
  CandidateService,
  type AnalysisDeps,
} from '@ormilo/domain';
import { analysisResultSchema, candidateAssessmentSchema, productBriefSchema } from '@ormilo/contracts';
import { createTextGenerationProvider } from '@ormilo/integrations';
import { getResearchPrompt } from '@ormilo/templates';
import { createUnitOfWork } from '../src/repositories.js';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('M2 analysis pipeline (PostgreSQL + mock AI)', () => {
  const prisma = new PrismaClient();
  const uow = createUnitOfWork(prisma);
  const candidates = new CandidateService(uow);
  const analysis = new CandidateAnalysisService(uow);
  const actor = { userId: '', role: 'ADMIN' as const };

  const deps: AnalysisDeps = {
    textGenerator: createTextGenerationProvider({ provider: 'mock' }),
    prompts: {
      brief: getResearchPrompt('product-brief'),
      assessment: getResearchPrompt('candidate-assessment'),
    },
    schemas: { brief: productBriefSchema, assessment: candidateAssessmentSchema },
  };

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'analysis-int@ormilo.local' },
      update: {},
      create: {
        email: 'analysis-int@ormilo.local',
        name: 'Analysis Integration',
        role: 'ADMIN',
        passwordHash: 'scrypt-v1:unused:unused',
      },
    });
    actor.userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('request → run: результат персистується, статус/score/decision оновлені', async () => {
    const candidate = await candidates.createManual(
      {
        sourceType: 'MANUAL',
        title: `Аналіз-інтеграція ${Date.now()}`,
        rawData: { price: 29.99, cost: 6, shipping: 2, days_running: 60, creativeCount: 10 },
      },
      actor,
    );

    const requested = await analysis.requestAnalysis(candidate.id, actor);
    expect(requested.status).toBe('ANALYZING');

    const result = await analysis.runAnalysis(candidate.id, deps);
    expect(result.score.total).toBeGreaterThan(0);

    const stored = await prisma.productCandidate.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    expect(stored.score).toBe(result.score.total);
    expect(stored.status).not.toBe('ANALYZING');
    expect(stored.decision).not.toBeNull();

    // Персистований JSON проходить контрактну схему (роблять web-сторінки).
    const parsed = analysisResultSchema.parse(stored.normalizedDataJson);
    expect(parsed.pricing).not.toBeNull();
    expect(parsed.brief.angles.length).toBeGreaterThanOrEqual(3);

    const events = await prisma.outboxEvent.findMany({
      where: { type: { in: ['ProductAnalysisRequested', 'ProductAnalysisCompleted'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.length).toBeGreaterThanOrEqual(2);

    const auditActions = (
      await prisma.auditLog.findMany({
        where: { entityId: candidate.id },
        orderBy: { createdAt: 'asc' },
      })
    ).map((entry) => entry.action);
    expect(auditActions).toEqual(
      expect.arrayContaining(['candidate.analysis-requested', 'candidate.analyzed']),
    );
  });
});
