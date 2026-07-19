import { cn } from '@ormilo/ui';
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/server/auth';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  validation: 'Перевірте email і пароль (щонайменше 8 символів).',
  credentials: 'Невірний email або пароль.',
  server: 'Сервіс тимчасово недоступний. Перевірте, чи запущено БД, і спробуйте ще раз.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Сталася помилка.') : null;

  const inputClasses =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ' +
    'focus:border-slate-500 focus:outline-none';

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Ormilo Growth OS</h1>
        <p className="text-sm text-slate-600">Вхід для внутрішніх користувачів</p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </p>
      ) : null}

      <form action={loginAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            placeholder="admin@ormilo.local"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Пароль
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={inputClasses}
          />
        </label>
        <button
          type="submit"
          className={cn(
            'inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2',
            'text-sm font-medium text-white transition-colors hover:bg-slate-700',
          )}
        >
          Увійти
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Обліковий запис створюється через seed data (див. docs/setup.md).
      </p>
    </main>
  );
}
