import { z } from 'zod';

/**
 * Конверт доменної події (ТЗ §8): зберігається в outbox, передається через BullMQ.
 * Payload валідуються схемами нижче на боці споживача.
 */
export const domainEventEnvelopeSchema = z.object({
  id: z.uuid(),
  type: z.string().min(1),
  occurredAt: z.iso.datetime(),
  version: z.literal(1),
  payload: z.unknown(),
});

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

/** Схеми payload подій Milestone 1 (перелік §8 розширюється по milestones). */
export const domainEventPayloadSchemas = {
  ProductCandidateImported: z.object({ candidateId: z.uuid() }),
  ApprovalRequested: z.object({ approvalId: z.uuid() }),
  ApprovalDecided: z.object({
    approvalId: z.uuid(),
    status: z.enum(['APPROVED', 'REJECTED']),
  }),
  ProductCreatedFromCandidate: z.object({
    productId: z.uuid(),
    candidateId: z.uuid(),
  }),
} as const;

export type DomainEventType = keyof typeof domainEventPayloadSchemas;

export function isKnownDomainEventType(type: string): type is DomainEventType {
  return type in domainEventPayloadSchemas;
}
