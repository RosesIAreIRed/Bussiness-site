import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/passwords.js';
import {
  DecryptionError,
  EncryptionError,
  decryptString,
  encryptString,
} from '../src/security/encryption.js';
import { createSessionToken, verifySessionToken } from '../src/security/session.js';

const KEY = 'ab'.repeat(32);
const OTHER_KEY = 'cd'.repeat(32);

describe('passwords (scrypt)', () => {
  it('хешує і верифікує пароль', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('scrypt-v1:')).toBe(true);
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true);
    expect(await verifyPassword('wrong-password!', hash)).toBe(false);
  });

  it('однаковий пароль дає різні хеші (унікальна сіль)', async () => {
    const first = await hashPassword('same-password-123');
    const second = await hashPassword('same-password-123');
    expect(first).not.toBe(second);
  });

  it('відхиляє закороткий пароль і невалідний формат збереження', async () => {
    await expect(hashPassword('short')).rejects.toThrow('щонайменше 8');
    expect(await verifyPassword('whatever-pass', 'garbage')).toBe(false);
    expect(await verifyPassword('whatever-pass', 'bcrypt:x:y')).toBe(false);
  });
});

describe('encryption (AES-256-GCM)', () => {
  it('шифрує і розшифровує рядок', () => {
    const ciphertext = encryptString('shpat_secret_token_123', KEY);
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(ciphertext).not.toContain('shpat_secret_token_123');
    expect(decryptString(ciphertext, KEY)).toBe('shpat_secret_token_123');
  });

  it('різні виклики дають різний ciphertext (унікальний IV)', () => {
    expect(encryptString('same', KEY)).not.toBe(encryptString('same', KEY));
  });

  it('відхиляє невірний ключ, пошкоджені дані та невалідний формат ключа', () => {
    const ciphertext = encryptString('secret', KEY);
    expect(() => decryptString(ciphertext, OTHER_KEY)).toThrow(DecryptionError);
    expect(() => decryptString('v1:bad:data', KEY)).toThrow(DecryptionError);
    expect(() => encryptString('x', 'not-hex')).toThrow(EncryptionError);
  });
});

describe('session tokens (HMAC)', () => {
  it('створює і верифікує токен', () => {
    const token = createSessionToken({ userId: 'u1', role: 'ADMIN', ttlSec: 3600 }, KEY);
    const result = verifySessionToken(token, KEY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sub).toBe('u1');
      expect(result.value.role).toBe('ADMIN');
    }
  });

  it('відхиляє підробку, чужий ключ і протермінований токен', () => {
    const token = createSessionToken({ userId: 'u1', role: 'ADMIN', ttlSec: 3600 }, KEY);

    const wrongKey = verifySessionToken(token, OTHER_KEY);
    expect(!wrongKey.ok && wrongKey.error).toBe('BAD_SIGNATURE');

    const [body] = token.split('.');
    const forged = `${body}.${'A'.repeat(43)}`;
    const forgedResult = verifySessionToken(forged, KEY);
    expect(forgedResult.ok).toBe(false);

    const malformed = verifySessionToken('not-a-token', KEY);
    expect(!malformed.ok && malformed.error).toBe('MALFORMED');

    const expired = createSessionToken(
      { userId: 'u1', role: 'ADMIN', ttlSec: 10 },
      KEY,
      new Date(Date.now() - 60_000),
    );
    const expiredResult = verifySessionToken(expired, KEY);
    expect(!expiredResult.ok && expiredResult.error).toBe('EXPIRED');
  });
});
