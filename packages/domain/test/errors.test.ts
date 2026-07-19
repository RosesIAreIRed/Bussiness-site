import { describe, expect, it } from 'vitest';
import { DomainError, UnknownJobTypeError } from '../src/errors.js';

describe('DomainError', () => {
  it('зберігає код, деталі та cause', () => {
    const cause = new Error('низькорівнева');
    const error = new DomainError('TEST_CODE', 'повідомлення', {
      details: { a: 1 },
      cause,
    });

    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ a: 1 });
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('DomainError');
    expect(error).toBeInstanceOf(Error);
  });

  it('UnknownJobTypeError має стабільний код і деталі', () => {
    const error = new UnknownJobTypeError('render', 'creative.render');

    expect(error.code).toBe('QUEUE_UNKNOWN_JOB');
    expect(error.details).toEqual({ queue: 'render', jobName: 'creative.render' });
    expect(error.name).toBe('UnknownJobTypeError');
    expect(error).toBeInstanceOf(DomainError);
  });
});
