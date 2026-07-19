import { z } from 'zod';

/** Zod-схеми вхідних даних UI/API (ТЗ §25: Zod для external payloads). */

export const loginInputSchema = z.object({
  email: z.email('Невалідний email'),
  password: z.string().min(8, 'Пароль має містити щонайменше 8 символів'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

const optionalUrl = z
  .union([z.url('Невалідний URL'), z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

export const createCandidateInputSchema = z.object({
  title: z.string().trim().min(3, 'Назва — щонайменше 3 символи').max(200),
  sourceUrl: optionalUrl,
  supplierUrl: optionalUrl,
  storeUrl: optionalUrl,
  adLibraryUrl: optionalUrl,
});

export type CreateCandidateInput = z.infer<typeof createCandidateInputSchema>;

export const decideApprovalInputSchema = z.object({
  approvalId: z.uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().trim().max(500).optional(),
});

export type DecideApprovalInput = z.infer<typeof decideApprovalInputSchema>;
