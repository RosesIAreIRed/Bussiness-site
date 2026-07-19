import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const FORMAT = 'scrypt-v1';

/**
 * Хешування паролів через node:crypto scrypt (без зовнішніх залежностей).
 * Формат зберігання: `scrypt-v1:<salt base64>:<hash base64>` — версіонований,
 * щоб у майбутньому мігрувати параметри без ламання наявних хешів.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Пароль має містити щонайменше 8 символів');
  }
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${FORMAT}:${salt.toString('base64')}:${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [format, saltB64, hashB64] = stored.split(':');
  if (format !== FORMAT || !saltB64 || !hashB64) {
    return false;
  }
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) {
    return false;
  }
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}
