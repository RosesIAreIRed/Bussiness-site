import type { Product } from '@ormilo/domain';
import { requireSession } from '../../../lib/server/auth';
import { getAppContext } from '../../../lib/server/context';
import { DataError, EmptyState, PageHeader, Panel, formatDateTime } from '../../../components/page-shell';
import { StatusBadge } from '../../../components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  await requireSession();

  let products: Product[] | null = null;
  try {
    products = await getAppContext().readRepos.products.list({ take: 50 });
  } catch {
    products = null;
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Внутрішні product drafts. Генерація сторінки — M2, публікація в Shopify — M4."
      />

      <Panel>
        {products === null ? (
          <DataError message="Не вдалося прочитати products із БД." />
        ) : products.length === 0 ? (
          <EmptyState message="Продуктів ще немає. Створіть кандидата в Research і затвердьте його в Approvals." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Назва</th>
                  <th className="py-2 pr-4">Статус</th>
                  <th className="py-2 pr-4">Shopify</th>
                  <th className="py-2">Створено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="py-2.5 pr-4 font-medium">{product.title}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={product.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">
                      {product.shopifyProductGid ?? 'не опубліковано'}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-500">
                      {formatDateTime(product.createdAt)}
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
