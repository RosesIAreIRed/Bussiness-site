import { createHmac, timingSafeEqual } from 'node:crypto';
import { err, ok, type Result } from '../result.js';

export interface SessionPayload {
  /** User id. */
  sub: string;
  role: string;
  /** Unix time (секунди) закінчення дії. */
  exp: number;
}

export type SessionError = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED';

function sign(data: string, keyHex: string): Buffer {
  return createHmac('sha256', Buffer.from(keyHex, 'hex')).update(data).digest();
}

/**
 * Stateless session token: `base64url(payload).base64url(hmac-sha256)`.
 * Підписується ENCRYPTION_KEY-ом; жодних секретів у payload.
 */
export function createSessionToken(
  input: { userId: string; role: string; ttlSec: number },
  keyHex: string,
  now: Date = new Date(),
): string {
  const payload: SessionPayload = {
    sub: input.userId,
    role: input.role,
    exp: Math.floor(now.getTime() / 1000) + input.ttlSec,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(body, keyHex).toString('base64url');
  return `${body}.${signature}`;
}

export function verifySessionToken(
  token: string,
  keyHex: string,
  now: Date = new Date(),
): Result<SessionPayload, SessionError> {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return err('MALFORMED');
  }

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signature, 'base64url');
  } catch {
    return err('MALFORMED');
  }
  const expectedSignature = sign(body, keyHex);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return err('BAD_SIGNATURE');
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return err('MALFORMED');
  }
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return err('MALFORMED');
  }
  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    return err('EXPIRED');
  }
  return ok(payload);
}
