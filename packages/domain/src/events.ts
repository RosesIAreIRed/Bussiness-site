/**
 * Уніфікований конверт доменної події.
 * У Milestone 1 події зберігатимуться в outbox-таблиці та публікуватимуться
 * background worker-ом; конверт стабільний від початку.
 */
export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly id: string;
  readonly type: TType;
  readonly occurredAt: string;
  readonly version: 1;
  readonly payload: TPayload;
}

export function createDomainEvent<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
): DomainEvent<TType, TPayload> {
  return {
    id: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    version: 1,
    payload,
  };
}
