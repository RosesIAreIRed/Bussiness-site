import { createDomainEvent } from '../events.js';
import { CandidateNotFoundError } from '../core/candidate-service.js';
import type { UnitOfWork } from '../core/repositories.js';
import type { Actor, CandidateDecision, CandidateStatus, ProductCandidate } from '../core/types.js';
import { checkCompliance } from './compliance.js';
import { normalizeCandidateData } from './normalize.js';
import { computeProductScore } from './scoring.js';
import { computePricing, evaluatePriceEconomics } from './pricing.js';
import type {
  AnalysisResult,
  AutoDecision,
  CandidateAssessment,
  PriceEconomics,
  PricingResult,
  ProductBrief,
} from './types.js';

/**
 * Структурна абстракція schema-валідатора (сумісна із Zod без залежності
 * domain-пакета від zod): достатньо методу parse.
 */
export interface SchemaLike<T> {
  parse(value: unknown): T;
}

/** Порт текстового AI-провайдера (реалізації — в @ormilo/integrations). */
export interface StructuredTextGenerator {
  generateStructured<T>(input: {
    systemPrompt: string;
    userPrompt: string;
    schema: SchemaLike<T>;
    model?: string;
  }): Promise<T>;
}

/** Versioned prompt (ТЗ §14); конкретні шаблони — в @ormilo/templates. */
export interface AnalysisPrompt {
  key: string;
  version: number;
  systemPrompt: string;
  buildUserPrompt(vars: Record<string, string>): string;
}

export interface AnalysisDeps {
  textGenerator: StructuredTextGenerator;
  prompts: { brief: AnalysisPrompt; assessment: AnalysisPrompt };
  schemas: { brief: SchemaLike<ProductBrief>; assessment: SchemaLike<CandidateAssessment> };
  now?: () => Date;
}

const DECISION_TO_STATUS: Record<AutoDecision, CandidateStatus> = {
  REJECT: 'REJECTED',
  WATCH: 'WATCH',
  TEST: 'TEST',
};

const DECISION_TO_CANDIDATE_DECISION: Record<AutoDecision, CandidateDecision> = {
  REJECT: 'REJECT',
  WATCH: 'WATCH',
  TEST: 'TEST',
};

/**
 * Product Intelligence (ТЗ §2.2, §21 M2).
 * requestAnalysis — швидка транзакція з UI; сам аналіз виконує worker
 * (подія ProductAnalysisRequested через outbox), щоб AI-виклики не жили
 * в web-запиті й не тримали транзакцію.
 */
export class CandidateAnalysisService {
  constructor(private readonly uow: UnitOfWork) {}

  async requestAnalysis(candidateId: string, actor: Actor): Promise<ProductCandidate> {
    return this.uow(async (repos) => {
      const candidate = await repos.candidates.findById(candidateId);
      if (!candidate) {
        throw new CandidateNotFoundError(candidateId);
      }
      // Idempotent: повторний запит під час аналізу не плодить події.
      if (candidate.status === 'ANALYZING') {
        return candidate;
      }

      const updated = await repos.candidates.update(candidateId, { status: 'ANALYZING' });

      await repos.audit.append({
        actorType: 'USER',
        actorId: actor.userId,
        action: 'candidate.analysis-requested',
        entityType: 'product_candidate',
        entityId: candidateId,
        metadata: { previousStatus: candidate.status },
      });

      await repos.outbox.append(createDomainEvent('ProductAnalysisRequested', { candidateId }));

      return updated;
    });
  }

  /**
   * Виконання аналізу (worker-side). AI-виклики — поза транзакцією;
   * результат, audit і подія пишуться атомарно. Повторний запуск (retry job)
   * перезаписує результат — операція idempotent за наслідками.
   */
  async runAnalysis(candidateId: string, deps: AnalysisDeps): Promise<AnalysisResult> {
    const now = deps.now ?? (() => new Date());

    const candidate = await this.uow((repos) => repos.candidates.findByIdWithData(candidateId));
    if (!candidate) {
      throw new CandidateNotFoundError(candidateId);
    }

    const normalized = normalizeCandidateData({
      title: candidate.title,
      rawData: candidate.rawData,
    });

    const promptVars: Record<string, string> = {
      title: candidate.title,
      sourceUrl: candidate.sourceUrl ?? '—',
      supplierUrl: candidate.supplierUrl ?? '—',
      data: JSON.stringify({ raw: candidate.rawData, normalized }),
    };

    const brief = await deps.textGenerator.generateStructured({
      systemPrompt: deps.prompts.brief.systemPrompt,
      userPrompt: deps.prompts.brief.buildUserPrompt(promptVars),
      schema: deps.schemas.brief,
    });

    const assessment = await deps.textGenerator.generateStructured({
      systemPrompt: deps.prompts.assessment.systemPrompt,
      userPrompt: deps.prompts.assessment.buildUserPrompt({
        ...promptVars,
        briefSummary: brief.summary,
      }),
      schema: deps.schemas.assessment,
    });

    const compliance = checkCompliance({
      texts: [
        brief.summary,
        ...brief.angles.flatMap((angle) => angle.hooks),
        assessment.recommendedOffer,
      ],
      claims: brief.riskyClaims,
    });

    // BLOCKED compliance → нереалістичні claims тягнуть штраф до критичного рівня.
    const penalties =
      compliance.status === 'BLOCKED'
        ? {
            ...assessment.penalties,
            unrealisticClaims: Math.max(assessment.penalties.unrealisticClaims, 0.9),
          }
        : assessment.penalties;

    let pricing: PricingResult | null = null;
    let sellingEconomics: PriceEconomics | null = null;
    if (normalized.estimatedCost !== null) {
      const pricingInput = {
        supplierCost: normalized.estimatedCost,
        shippingCost: normalized.shippingEstimate ?? 0,
      };
      pricing = computePricing(pricingInput);
      if (normalized.sellingPrice !== null && normalized.sellingPrice > 0) {
        sellingEconomics = evaluatePriceEconomics(normalized.sellingPrice, pricingInput);
      }
    }

    const score = computeProductScore(
      {
        estimatedDaysRunning: normalized.estimatedDaysRunning,
        activeCreativeCount: normalized.activeCreativeCount,
        grossMarginRatio:
          sellingEconomics?.marginRatio ?? pricing?.atRecommended.marginRatio ?? null,
      },
      assessment.ratings,
      penalties,
    );

    const result: AnalysisResult = {
      analyzedAt: now().toISOString(),
      prompts: [
        { key: deps.prompts.brief.key, version: deps.prompts.brief.version },
        { key: deps.prompts.assessment.key, version: deps.prompts.assessment.version },
      ],
      normalized,
      brief,
      assessment: { ...assessment, penalties },
      compliance,
      score,
      pricing,
      sellingEconomics,
    };

    await this.uow(async (repos) => {
      await repos.candidates.update(candidateId, {
        score: score.total,
        decision: DECISION_TO_CANDIDATE_DECISION[score.autoDecision],
        status: DECISION_TO_STATUS[score.autoDecision],
        normalizedData: result as unknown as Record<string, unknown>,
      });

      await repos.audit.append({
        actorType: 'SYSTEM',
        action: 'candidate.analyzed',
        entityType: 'product_candidate',
        entityId: candidateId,
        metadata: {
          score: score.total,
          decision: score.autoDecision,
          complianceStatus: compliance.status,
          criticalFlags: score.criticalFlags,
        },
      });

      await repos.outbox.append(
        createDomainEvent('ProductAnalysisCompleted', {
          candidateId,
          score: score.total,
          decision: score.autoDecision,
        }),
      );
    });

    return result;
  }
}
