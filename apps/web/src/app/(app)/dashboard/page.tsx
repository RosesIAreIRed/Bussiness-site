import Link from 'next/link';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, PageHeader, Panel, formatDateTime } from '../../../components/page-shell';

export const dynamic = 'force-dynamic';

interface DashboardData {
  pendingApprovals: number;
  candidatesByStatus: Partial<Record<string, number>>;
  productsCount: number;
  recentAudit: Array<{ id: string; action: string; entityType: string; createdAt: Date }>;
}

async function loadDashboard(): Promise<DashboardData> {
  const { readRepos } = getAppContext();
  const [pendingApprovals, candidatesByStatus, productsCount, recentAudit] = await Promise.all([
    readRepos.approvals.countPending(),
    readRepos.candidates.countByStatus(),
    readRepos.products.count(),
    readRepos.audit.list(8),
  ]);
  return { pendingApprovals, candidatesByStatus, productsCount, recentAudit };
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
    >
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  await requireSession();

  let data: DashboardData | null = null;
  let loadError = false;
  try {
    data = await loadDashboard();
  } catch {
    loadError = true;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Огляд стану системи. Розширені метрики (revenue, ROAS, profit) — Milestone 6."
      />

      {loadError || !data ? (
        <DataError message="Не вдалося прочитати дані з БД. Перевірте, чи запущено інфраструктуру (docker compose up -d) і чи застосовано міграції (pnpm db:migrate)." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Approvals в очікуванні"
              value={data.pendingApprovals}
              href="/approvals"
            />
            <StatCard
              label="Кандидати (усього)"
              value={Object.values(data.candidatesByStatus).reduce<number>(
                (sum, count) => sum + (count ?? 0),
                0,
              )}
              href="/research"
            />
            <StatCard label="Products" value={data.productsCount} href="/products" />
          </div>

          <Panel title="Кандидати за статусами (Research Board)">
            <div className="flex flex-wrap gap-4 text-sm">
              {(['INBOX', 'ANALYZING', 'WATCH', 'TEST', 'REJECTED', 'WINNER'] as const).map(
                (status) => (
                  <div key={status} className="flex items-baseline gap-2">
                    <span className="text-slate-500">{status}</span>
                    <span className="font-semibold tabular-nums">
                      {data.candidatesByStatus[status] ?? 0}
                    </span>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <Panel title="Останні події audit log">
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-slate-500">Поки що порожньо.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 text-sm">
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="font-mono text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    <span className="flex-1">{entry.action}</span>
                    <span className="text-slate-500">{entry.entityType}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
