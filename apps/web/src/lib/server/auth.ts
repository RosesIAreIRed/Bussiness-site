import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createSessionToken,
  verifyPassword,
  verifySessionToken,
  type User,
  type UserRole,
} from '@ormilo/domain';
import { getAppContext } from './context';

export const SESSION_COOKIE = 'ormilo_session';
const SESSION_TTL_SEC = 12 * 60 * 60;

const ROLES: readonly UserRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];

export interface CurrentSession {
  userId: string;
  role: UserRole;
}

/** Фіктивний хеш для вирівнювання часу відповіді при невідомому email. */
const DUMMY_HASH = 'scrypt-v1:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

/**
 * Перевіряє креденшели і встановлює session cookie.
 * Викликається лише із Server Action (cookie мутації дозволені там).
 */
export async function attemptLogin(email: string, password: string): Promise<boolean> {
  const ctx = getAppContext();
  const user = await ctx.users.findByEmail(email.toLowerCase().trim());

  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return false;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return false;
  }

  const token = createSessionToken(
    { userId: user.id, role: user.role, ttlSec: SESSION_TTL_SEC },
    ctx.env.ENCRYPTION_KEY,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.env.APP_URL.startsWith('https://'),
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  return true;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const result = verifySessionToken(token, getAppContext().env.ENCRYPTION_KEY);
  if (!result.ok) {
    return null;
  }

  const role = result.value.role;
  if (!ROLES.includes(role as UserRole)) {
    return null;
  }
  return { userId: result.value.sub, role: role as UserRole };
}

/** Гейт захищених сторінок: без валідної сесії — редірект на /login. */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function getCurrentUser(session: CurrentSession): Promise<User | null> {
  return getAppContext().users.findById(session.userId);
}
