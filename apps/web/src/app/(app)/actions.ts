'use server';

import { redirect } from 'next/navigation';
import { clearSession } from '../../lib/server/auth';

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
