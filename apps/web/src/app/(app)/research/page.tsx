import type { ProductCandidate } from '@ormilo/domain';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, EmptyState, PageHeader, Panel, formatDateTime } from '../../../components/page-shell';
import { StatusBadge } from '../../../components/status-badge';
import { createCandidateAction, requestProductApprovalAction } from './actions';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  validation: 'Перевірте поля форми (назва — щонайменше 3 символи, URL — валідні).',
  forbidden: 'Роль VIEWER не має права на цю дію.',
  server: 'Не вдалося виконати операцію. Перевірте стан інфраструктури.',
};

const inputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
  'focus:border-slate-500 focus:outline-none';

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; requested?: string }>;
}) {
  const session = await requireSession();
  const { error, requested } = await searchParams;
  const canWrite = session.role !== 'VIEWER';

  let candidates: ProductCandidate[] | null = null;
  try {
    candidates = await getAppContext().readRepos.candidates.list({ take: 50 });
  } catch {
    candidates = null;
  }

  return (
    <>
      <PageHeader
        title="Research Board"
        subtitle="Кандидати на товари (ТЗ §2.2). AI-аналіз і scoring зʼявляться в Milestone 2."
      />

      {error ? <DataError message={ERROR_MESSAGES[error] ?? 'Сталася помилка.'} /> : null}
      {requested ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Approval-запит створено — див. вкладку Approvals.
        </p>
      ) : null}

      {canWrite ? (
        <Panel title="Додати кандидата вручну">
          <form action={createCandidateAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-3">
              Назва товару *
              <input
                type="text"
                name="title"
                required
                minLength={3}
                placeholder="Портативний блендер для смузі"
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              URL джерела
              <input
                type="url"
                name="sourceUrl"
                placeholder="https://…"
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              URL постачальника
              <input
                type="url"
                name="supplierUrl"
                placeholder="https://…"
                className={inputClasses}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                Додати кандидата
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Кандидати">
        {candidates === null ? (
          <DataError message="Не вдалося прочитати кандидатів із БД." />
        ) : candidates.length === 0 ? (
          <EmptyState message="Кандидатів ще немає — додайте першого через форму вище." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Назва</th>
                  <th className="py-2 pr-4">Статус</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Створено</th>
                  {canWrite ? <th className="py-2">Дії</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{candidate.title}</div>
                      {candidate.sourceUrl ? (
                        <a
                          href={candidate.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-500 underline"
                        >
                          джерело
                        </a>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={candidate.status} />
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{candidate.score ?? '—'}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">
                      {formatDateTime(candidate.createdAt)}
                    </td>
                    {canWrite ? (
                      <td className="py-2.5">
                        {candidate.status === 'INBOX' || candidate.status === 'ANALYZING' ? (
                          <form action={requestProductApprovalAction}>
                            <input type="hidden" name="candidateId" value={candidate.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs transition-colors hover:bg-slate-100"
                            >
                              Approval на продукт
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
