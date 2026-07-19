import { cn } from '@ormilo/ui';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-rose-100 text-rose-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
};

/** Мапінг доменних статусів на тони бейджів. */
export const STATUS_TONES: Record<string, BadgeTone> = {
  // candidates (kanban §11)
  INBOX: 'info',
  ANALYZING: 'warning',
  WATCH: 'neutral',
  TEST: 'success',
  REJECTED: 'danger',
  WINNER: 'success',
  // approvals (§19)
  PENDING: 'warning',
  APPROVED: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  // products
  DRAFT: 'info',
  ACTIVE: 'success',
  ARCHIVED: 'neutral',
};

export function StatusBadge({ value, tone }: { value: string; tone?: BadgeTone }) {
  const resolved = tone ?? STATUS_TONES[value] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[resolved],
      )}
    >
      {value}
    </span>
  );
}
