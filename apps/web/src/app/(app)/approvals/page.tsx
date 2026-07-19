import type { Approval } from '@ormilo/domain';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, EmptyState, PageHeader, Panel, formatDateTime } from '../../../components/page-shell';
import { StatusBadge } from '../../../components/status-badge';
import { decideApprovalAction } from './actions';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  validation: 'Невалідні дані рішення.',
  APPROVAL_FORBIDDEN: 'Роль VIEWER не може вирішувати approvals.',
  APPROVAL_NOT_FOUND: 'Approval не знайдено (можливо, вже видалений).',
  APPROVAL_ALREADY_DECIDED: 'Цей approval уже вирішено з іншим результатом.',
  CANDIDATE_NOT_FOUND: 'Повʼязаного кандидата не знайдено.',
  SERVER: 'Не вдалося виконати операцію. Перевірте стан інфраструктури.',
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; decided?: string }>;
}) {
  const session = await requireSession();
  const { error, decided } = await searchParams;
  const canDecide = session.role !== 'VIEWER';
  const { readRepos } = getAppContext();

  let pending: Approval[] | null = null;
  let history: Approval[] | null = null;
  try {
    [pending, history] = await Promise.all([
      readRepos.approvals.listByStatus('PENDING', 50),
      readRepos.approvals.listDecided(20),
    ]);
  } catch {
    pending = null;
    history = null;
  }

  return (
    <>
      <PageHeader
        title="Approval Queue"
        subtitle="Жодна ризикована дія не виконується без ручного підтвердження (ТЗ §19)."
      />

      {error ? <DataError message={ERROR_MESSAGES[error] ?? 'Сталася помилка.'} /> : null}
      {decided ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Рішення збережено, audit log і подія в outbox записані.
        </p>
      ) : null}

      <Panel title="В очікуванні рішення">
        {pending === null ? (
          <DataError message="Не вдалося прочитати approvals із БД." />
        ) : pending.length === 0 ? (
          <EmptyState message="Черга порожня — немає дій, що очікують підтвердження." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {pending.map((approval) => (
              <li key={approval.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={approval.status} />
                  <span className="font-medium">{approval.action}</span>
                  <span className="text-sm text-slate-500">
                    {approval.entityType} · {approval.entityId.slice(0, 8)}…
                  </span>
                  <span className="ml-auto font-mono text-xs text-slate-500">
                    {formatDateTime(approval.createdAt)}
                  </span>
                </div>
                {canDecide ? (
                  <form
                    action={decideApprovalAction}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="approvalId" value={approval.id} />
                    <input
                      type="text"
                      name="comment"
                      placeholder="Коментар (необовʼязково)"
                      className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      name="decision"
                      value="APPROVED"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="REJECTED"
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-slate-400">Рішення доступні ролям ADMIN/OPERATOR.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Останні рішення">
        {history === null ? (
          <DataError message="Не вдалося прочитати історію approvals." />
        ) : history.length === 0 ? (
          <EmptyState message="Рішень ще не було." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {history.map((approval) => (
              <li key={approval.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <StatusBadge value={approval.status} />
                <span>{approval.action}</span>
                {approval.comment ? (
                  <span className="text-slate-500">«{approval.comment}»</span>
                ) : null}
                <span className="ml-auto font-mono text-xs text-slate-500">
                  {approval.decidedAt ? formatDateTime(approval.decidedAt) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
