import { describe, expect, it } from 'vitest';
import { err, fromPromise, isErr, isOk, map, ok, unwrapOr } from '../src/result.js';

describe('Result', () => {
  it('ok/err створюють коректні варіанти', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('boom'))).toBe(true);
  });

  it('unwrapOr повертає значення або fallback', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err<string>('x'), 0)).toBe(0);
  });

  it('map трансформує лише ok', () => {
    expect(map(ok(2), (v) => v * 2)).toEqual(ok(4));
    const failure = err('nope');
    expect(map(failure, (v: number) => v * 2)).toBe(failure);
  });

  it('fromPromise ловить reject і нормалізує не-Error', async () => {
    expect(await fromPromise(Promise.resolve(7))).toEqual(ok(7));

    const rejected = await fromPromise(Promise.reject(new Error('boom')));
    expect(isErr(rejected) && rejected.error.message).toBe('boom');

    const rejectedRaw = await fromPromise(Promise.reject('raw-string'));
    expect(isErr(rejectedRaw) && rejectedRaw.error).toBeInstanceOf(Error);
  });
});
