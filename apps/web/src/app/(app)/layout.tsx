import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@ormilo/ui';
import { getCurrentUser, requireSession } from '../../lib/server/auth';
import { StatusBadge } from '../../components/status-badge';
import { logoutAction } from './actions';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/research', label: 'Research' },
  { href: '/products', label: 'Products' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/audit', label: 'Audit' },
  { href: '/settings', label: 'Settings' },
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const user = await getCurrentUser(session).catch(() => null);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-bold tracking-tight">
              Ormilo Growth OS
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors',
                    'hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email ?? session.userId}</span>
            <StatusBadge value={session.role} tone="neutral" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Вийти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
