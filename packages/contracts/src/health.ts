import { z } from 'zod';

export const componentHealthSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['ok', 'error']),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export type ComponentHealth = z.infer<typeof componentHealthSchema>;

export const healthReportSchema = z.object({
  service: z.string().min(1),
  status: z.enum(['ok', 'degraded']),
  uptimeSec: z.number().nonnegative(),
  checkedAt: z.iso.datetime(),
  components: z.array(componentHealthSchema),
});

export type HealthReport = z.infer<typeof healthReportSchema>;
