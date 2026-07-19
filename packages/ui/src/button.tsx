import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn.js';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700',
        variant === 'secondary' &&
          'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
        className,
      )}
      {...props}
    />
  );
}
