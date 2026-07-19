'use server';

import { redirect } from 'next/navigation';
import { loginInputSchema } from '@ormilo/contracts';
import { attemptLogin } from '../../lib/server/auth';

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginInputSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect('/login?error=validation');
  }

  let success = false;
  let serverError = false;
  try {
    success = await attemptLogin(parsed.data.email, parsed.data.password);
  } catch {
    // Помилка інфраструктури (напр., БД недоступна) — не показуємо деталі.
    serverError = true;
  }

  if (serverError) {
    redirect('/login?error=server');
  }
  if (!success) {
    redirect('/login?error=credentials');
  }
  redirect('/dashboard');
}
