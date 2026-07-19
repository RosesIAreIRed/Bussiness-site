import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Обʼєднує класи з коректним злиттям Tailwind-утиліт (shadcn/ui-конвенція). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
