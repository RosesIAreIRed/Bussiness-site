import Link from 'next/link';
import { notFound } from 'next/navigation';
import { analysisResultSchema } from '@ormilo/contracts';
import type { AnalysisResult } from '@ormilo/domain';
import { requireSession } from '../../../../lib/server/auth';
import { getAppContext } from '../../../../lib/server/context';
import {
  DataError,
  EmptyState,
  PageHeader,
  Panel,
  formatDateTime,
} from '../../../../components/page-shell';
import { StatusBadge } from '../../../../components/status-badge';
import { requestAnalysisAction, requestProductApprovalAction } from '../actions';

export const dynamic = 'force-dynamic';

function money(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `$${value.toFixed(2)}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const COMPLIANCE_TONE = {
  PASS: 'success',
  PASS_WITH_WARNINGS: 'warning',
  BLOCKED: 'danger',
} as const;

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const canWrite = session.role !== 'VIEWER';

  const candidate = await getAppContext()
    .readRepos.candidates.findByIdWithData(id)
    .catch(() => null);
  if (!candidate) {
    notFound();
  }

  let analysis: AnalysisResult | null = null;
  let analysisCorrupted = false;
  if (candidate.normalizedData !== null && candidate.normalizedData !== undefined) {
    const parsed = analysisResultSchema.safeParse(candidate.normalizedData);
    if (parsed.success) {
      analysis = parsed.data;
    } else {
      analysisCorrupted = true;
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={candidate.title} subtitle={`Кандидат · ${candidate.sourceType}`} />
        <div className="flex items-center gap-3">
          <StatusBadge value={candidate.status} />
          {candidate.score !== null ? (
            <span className="text-2xl font-bold tabular-nums">{candidate.score}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/research" className="text-sm text-slate-500 underline underline-offset-2">
          ← до Research Board
        </Link>
        {canWrite && candidate.status !== 'ANALYZING' ? (
          <>
            <form action={requestAnalysisAction}>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                {analysis ? 'Аналізувати повторно' : 'Аналізувати'}
              </button>
            </form>
            {candidate.status !== 'REJECTED' ? (
              <form action={requestProductApprovalAction}>
                <input type="hidden" name="candidateId" value={candidate.id} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm transition-colors hover:bg-slate-100"
                >
                  Approval на продукт
                </button>
              </form>
            ) : null}
          </>
        ) : null}
        {candidate.status === 'ANALYZING' ? (
          <span className="text-sm text-amber-600">аналізується — оновіть сторінку за мить</span>
        ) : null}
      </div>

      {analysisCorrupted ? (
        <DataError message="Збережений результат аналізу не відповідає поточному контракту — запустіть аналіз повторно." />
      ) : null}

      {!analysis && !analysisCorrupted ? (
        <Panel>
          <EmptyState message="Кандидат ще не аналізувався. Запустіть аналіз — worker сформує brief, score, pricing і compliance-звіт." />
        </Panel>
      ) : null}

      {analysis ? (
        <>
          <Panel title={`Score: ${analysis.score.total}/100 · авто-рішення ${analysis.score.autoDecision}`}>
            {analysis.score.criticalFlags.length > 0 ? (
              <DataError
                message={`Критичні red flags: ${analysis.score.criticalFlags.join(', ')} — кандидат відхилено незалежно від балу.`}
              />
            ) : null}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Фактор</th>
                      <th className="py-1.5 pr-3">Вага</th>
                      <th className="py-1.5 pr-3">Оцінка</th>
                      <th className="py-1.5">Бали</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.score.factors.map((factor) => (
                      <tr key={factor.key}>
                        <td className="py-1.5 pr-3">{factor.key}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{factor.weight}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{pct(factor.score)}</td>
                        <td className="py-1.5 tabular-nums">{factor.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Ризик</th>
                      <th className="py-1.5 pr-3">Макс. штраф</th>
                      <th className="py-1.5 pr-3">Severity</th>
                      <th className="py-1.5">Бали</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.score.penalties.map((penalty) => (
                      <tr key={penalty.key}>
                        <td className="py-1.5 pr-3">{penalty.key}</td>
                        <td className="py-1.5 pr-3 tabular-nums">−{penalty.maxPenalty}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{pct(penalty.severity)}</td>
                        <td className="py-1.5 tabular-nums text-rose-700">{penalty.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel title="Pricing (ТЗ §2.3)">
            {analysis.pricing ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Мінімально життєздатна</dt>
                    <dd className="text-lg font-semibold">{money(analysis.pricing.minimumViablePrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Рекомендована</dt>
                    <dd className="text-lg font-semibold">{money(analysis.pricing.recommendedPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Compare-at</dt>
                    <dd className="text-lg font-semibold">{money(analysis.pricing.compareAtPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Bundle ×{analysis.pricing.assumptions.bundleSize}</dt>
                    <dd className="text-lg font-semibold">{money(analysis.pricing.bundlePrice)}</dd>
                  </div>
                </dl>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Маржа (рекоменд.)</dt>
                    <dd className="font-medium">{pct(analysis.pricing.atRecommended.marginRatio)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Break-even CPA</dt>
                    <dd className="font-medium">{money(analysis.pricing.atRecommended.breakEvenCpa)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Break-even ROAS</dt>
                    <dd className="font-medium">
                      {analysis.pricing.atRecommended.breakEvenRoas ?? 'недосяжний'}
                    </dd>
                  </div>
                  {analysis.sellingEconomics ? (
                    <div>
                      <dt className="text-slate-500">
                        Фактична ціна {money(analysis.sellingEconomics.price)}
                      </dt>
                      <dd className="font-medium">
                        маржа {pct(analysis.sellingEconomics.marginRatio)} · ROAS{' '}
                        {analysis.sellingEconomics.breakEvenRoas ?? 'недосяжний'}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <EmptyState message="Немає даних про собівартість — pricing не розраховано. Додайте cost у raw-дані кандидата." />
            )}
          </Panel>

          <Panel title="Compliance Guard (ТЗ §15)">
            <div className="flex items-center gap-3">
              <StatusBadge
                value={analysis.compliance.status}
                tone={COMPLIANCE_TONE[analysis.compliance.status]}
              />
              <span className="text-sm text-slate-600">
                {analysis.compliance.findings.length === 0
                  ? 'Порушень не виявлено.'
                  : `Знахідок: ${analysis.compliance.findings.length}`}
              </span>
            </div>
            {analysis.compliance.findings.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {analysis.compliance.findings.map((finding) => (
                  <li
                    key={`${finding.ruleId}-${finding.match}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <StatusBadge
                      value={finding.severity}
                      tone={finding.severity === 'BLOCKER' ? 'danger' : 'warning'}
                    />
                    <span className="font-medium">{finding.ruleId}</span>
                    <span className="text-slate-600">«{finding.match}»</span>
                    <span className="text-slate-500">— {finding.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <Panel title="Product Intelligence Brief (ТЗ §14)">
            <p className="text-sm">{analysis.brief.summary}</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Персони
                </h3>
                {analysis.brief.targetPersonas.map((persona) => (
                  <div key={persona.name} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium">{persona.name}</p>
                    <p className="text-slate-600">Болі: {persona.pains.join('; ')}</p>
                    <p className="text-slate-600">Бажання: {persona.desires.join('; ')}</p>
                    <p className="text-slate-600">Заперечення: {persona.objections.join('; ')}</p>
                  </div>
                ))}
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Переваги
                </h3>
                <ul className="list-inside list-disc text-sm text-slate-700">
                  {analysis.brief.benefits.map((benefit) => (
                    <li key={benefit.benefit}>
                      {benefit.benefit}{' '}
                      <span className="text-xs text-slate-400">
                        (впевненість {pct(benefit.confidence)}
                        {benefit.evidence ? '' : ', без доказів'})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Кути та hooks
                </h3>
                {analysis.brief.angles.map((angle) => (
                  <div key={angle.name} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium">{angle.name}</p>
                    <p className="text-xs text-slate-500">{angle.rationale}</p>
                    <ul className="mt-1 list-inside list-disc text-slate-700">
                      {angle.hooks.map((hook) => (
                        <li key={hook}>{hook}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Оцінка аналітика (AI)">
            <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Чому може продаватися
                </h3>
                <ul className="list-inside list-disc text-slate-700">
                  {analysis.assessment.whyItCanSell.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Чому може провалитися
                </h3>
                <ul className="list-inside list-disc text-slate-700">
                  {analysis.assessment.whyItCanFail.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Рекомендований офер
                </h3>
                <p className="text-slate-700">{analysis.assessment.recommendedOffer}</p>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Бракує матеріалів
                </h3>
                <ul className="list-inside list-disc text-slate-700">
                  {analysis.assessment.missingMaterials.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Аналіз від {formatDateTime(new Date(analysis.analyzedAt))} · prompts:{' '}
              {analysis.prompts.map((prompt) => `${prompt.key}@v${prompt.version}`).join(', ')}
            </p>
          </Panel>
        </>
      ) : null}
    </>
  );
}
