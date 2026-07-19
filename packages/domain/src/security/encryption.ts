import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DomainError } from '../errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const FORMAT = 'v1';

export class EncryptionError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super('ENCRYPTION_FAILED', message, { cause });
  }
}

export class DecryptionError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super('DECRYPTION_FAILED', message, { cause });
  }
}

function parseKey(keyHex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new EncryptionError('ENCRYPTION_KEY має бути 64 hex-символи (32 байти)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * AES-256-GCM шифрування рядків at rest (ТЗ §16: encrypted tokens, PII).
 * Формат: `v1:<iv b64>:<auth tag b64>:<ciphertext b64>`.
 */
export function encryptString(plaintext: string, keyHex: string): string {
  const key = parseKey(keyHex);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptString(payload: string, keyHex: string): string {
  const key = parseKey(keyHex);
  const [format, ivB64, tagB64, dataB64] = payload.split(':');
  if (format !== FORMAT || !ivB64 || !tagB64 || !dataB64) {
    throw new DecryptionError('Невалідний формат зашифрованих даних');
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (cause) {
    throw new DecryptionError('Не вдалося розшифрувати дані (невірний ключ або пошкоджені дані)', cause);
  }
}
