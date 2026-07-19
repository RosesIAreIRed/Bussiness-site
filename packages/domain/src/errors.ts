/**
 * Базова доменна помилка з машиночитаним кодом.
 * Код використовується для маршрутизації обробки (retry, alert, DLQ),
 * message — для людини.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.details = options?.details;
  }
}

/** Job невідомого типу потрапив у чергу — обробка неможлива, job має впасти у failed. */
export class UnknownJobTypeError extends DomainError {
  constructor(queue: string, jobName: string) {
    super('QUEUE_UNKNOWN_JOB', `Черга "${queue}" не має обробника для job "${jobName}"`, {
      details: { queue, jobName },
    });
  }
}
