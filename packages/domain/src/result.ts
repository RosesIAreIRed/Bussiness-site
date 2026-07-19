export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * Явний Result-тип для операцій, де помилка — очікуваний результат
 * (валідація, зовнішні виклики), а не виняткова ситуація.
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Обгортає Promise у Result, нормалізуючи не-Error значення. */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}
