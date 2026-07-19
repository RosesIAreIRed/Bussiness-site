import { cn } from '@ormilo/ui';

type MilestoneStatus = 'done' | 'in-progress' | 'planned';

const MILESTONES: ReadonlyArray<{ id: string; title: string; status: MilestoneStatus }> = [
  { id: 'M0', title: 'Інфраструктура: monorepo, Docker Compose, CI, health checks', status: 'done' },
  { id: 'M1', title: 'Core domain: users, stores, approvals, audit, outbox, BullMQ', status: 'planned' },
  { id: 'M2', title: 'Product research, scoring, pricing calculator', status: 'planned' },
  { id: 'M3', title: 'Creative Factory: briefs, статичні та відеокреативи', status: 'planned' },
  { id: 'M4', title: 'Shopify adapter і Product Draft publishing', status: 'planned' },
  { id: 'M5', title: 'Order routing, ManualSupplierAdapter, supplier monitor', status: 'planned' },
  { id: 'M6', title: 'Analytics, contribution margin, creative iteration', status: 'planned' },
];

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: 'готово',
  'in-progress': 'у роботі',
  planned: 'заплановано',
};

function StatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'done' && 'bg-emerald-100 text-emerald-800',
        status === 'in-progress' && 'bg-amber-100 text-amber-800',
        status === 'planned' && 'bg-slate-100 text-slate-600',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Ormilo Growth OS</h1>
        <p className="text-slate-600">
          Внутрішня платформа автоматизації Shopify-дропшипінгу: product research і scoring,
          генерація сторінок товару, Creative Factory, публікація в Shopify, контроль
          постачальників, маршрутизація замовлень та аналітика — з обовʼязковим ручним
          підтвердженням усіх небезпечних дій.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Стан системи</h2>
        <p className="text-sm text-slate-600">
          Компонентні перевірки PostgreSQL і Redis доступні на health-ендпоінті:
        </p>
        <a
          href="/api/health"
          className={cn(
            'inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white px-4 py-2',
            'font-mono text-sm text-slate-900 transition-colors hover:bg-slate-100',
          )}
        >
          /api/health
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Milestones</h2>
        <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {MILESTONES.map((milestone) => (
            <li key={milestone.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="font-mono text-sm font-semibold text-slate-500">
                  {milestone.id}
                </span>
                <span className="text-sm">{milestone.title}</span>
              </div>
              <StatusBadge status={milestone.status} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
