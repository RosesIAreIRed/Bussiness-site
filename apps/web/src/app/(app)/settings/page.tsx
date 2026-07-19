import { getCurrentUser, requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, PageHeader, Panel } from '../../../components/page-shell';
import { StatusBadge } from '../../../components/status-badge';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireSession();
  const { env, prisma } = getAppContext();

  const user = await getCurrentUser(session).catch(() => null);

  let storeConnected: boolean | null = null;
  let storeDomain: string | null = null;
  try {
    const store = await prisma.store.findFirst();
    storeConnected = store !== null;
    storeDomain = store?.shopDomain ?? null;
  } catch {
    storeConnected = null;
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Налаштування системи та інтеграцій." />

      <Panel title="Користувач">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Імʼя</dt>
            <dd className="font-medium">{user?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Роль</dt>
            <dd>
              <StatusBadge value={session.role} tone="neutral" />
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Shopify">
        {storeConnected === null ? (
          <DataError message="Не вдалося прочитати стан підключення з БД." />
        ) : storeConnected ? (
          <p className="text-sm">
            Підключено магазин <span className="font-medium">{storeDomain}</span> (API version{' '}
            {env.SHOPIFY_API_VERSION}).
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Магазин не підключено. Підключення Shopify (encrypted token, GraphQL client) —{' '}
            <span className="font-medium">Milestone 4</span>. Версія API з конфігурації:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {env.SHOPIFY_API_VERSION}
            </code>
            .
          </p>
        )}
      </Panel>

      <Panel title="Середовище">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">APP_ENV</dt>
            <dd className="font-medium">{env.APP_ENV}</dd>
          </div>
          <div>
            <dt className="text-slate-500">AI daily budget</dt>
            <dd className="font-medium">${env.AI_DAILY_BUDGET_USD}</dd>
          </div>
          <div>
            <dt className="text-slate-500">AI batch budget</dt>
            <dd className="font-medium">${env.AI_CREATIVE_BATCH_BUDGET_USD}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">
          AI providers, brand kit, compliance rules і automation — у наступних milestones
          (див. docs/implementation-plan.md).
        </p>
      </Panel>
    </>
  );
}
