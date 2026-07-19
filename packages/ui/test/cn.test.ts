import { describe, expect, it } from 'vitest';
import { cn } from '../src/cn.js';

describe('cn', () => {
  it('обʼєднує класи та відкидає falsy-значення', () => {
    const inactive: boolean = false;
    expect(cn('a', inactive && 'b', undefined, 'c')).toBe('a c');
  });

  it('зливає конфліктні Tailwind-утиліти (останній виграє)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });
});
