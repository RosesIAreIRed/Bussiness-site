/** Політика публікації outbox-подій (ТЗ §8, §9: retry + backoff + dead-letter). */

export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_BASE_DELAY_MS = 1_000;
export const OUTBOX_MAX_DELAY_MS = 5 * 60_000;

/** Exponential backoff: 1s, 2s, 4s, ... з обмеженням 5 хвилин. */
export function computeOutboxBackoffMs(attempt: number): number {
  const safeAttempt = Math.max(0, attempt);
  return Math.min(OUTBOX_MAX_DELAY_MS, OUTBOX_BASE_DELAY_MS * 2 ** safeAttempt);
}

/** Чи вичерпано ліміт спроб (подія переходить у FAILED / dead-letter). */
export function isOutboxExhausted(attempts: number): boolean {
  return attempts >= OUTBOX_MAX_ATTEMPTS;
}
