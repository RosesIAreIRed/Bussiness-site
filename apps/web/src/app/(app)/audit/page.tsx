import type { AuditEntry } from '@ormilo/domain';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, EmptyState, PageHeader, Panel, formatDateTime } from '../../../components/page-shell';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requireSession();

  let entries: AuditEntry[] | null = null;
  try {
    entries = await getAppContext().readRepos.audit.list(50);
  } catch {
    entries = null;
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Незмінний журнал усіх мутацій системи (ТЗ §7 audit_logs, §16)."
      />

      <Panel>
        {entries === null ? (
          <DataError message="Не вдалося прочитати audit log із БД." />
        ) : entries.length === 0 ? (
          <EmptyState message="Записів ще немає." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Час (UTC)</th>
                  <th className="py-2 pr-4">Актор</th>
                  <th className="py-2 pr-4">Дія</th>
                  <th className="py-2 pr-4">Обʼєкт</th>
                  <th className="py-2">Метадані</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs">
                      {entry.actorType}
                      {entry.actorId ? ` · ${entry.actorId.slice(0, 8)}…` : ''}
                    </td>
                    <td className="py-2.5 pr-4 font-medium">{entry.action}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                    </td>
                    <td className="py-2.5">
                      <code className="block max-w-md overflow-x-auto whitespace-nowrap text-xs text-slate-600">
                        {JSON.stringify(entry.metadataJson)}
                      </code>
                    </td>
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
