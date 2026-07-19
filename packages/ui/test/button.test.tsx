import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../src/button.js';

describe('Button', () => {
  it('рендерить primary-варіант за замовчуванням', () => {
    const html = renderToStaticMarkup(<Button>Зберегти</Button>);

    expect(html).toContain('Зберегти');
    expect(html).toContain('bg-slate-900');
  });

  it('рендерить secondary-варіант і зливає додаткові класи', () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" className="w-full">
        Скасувати
      </Button>,
    );

    expect(html).toContain('border-slate-300');
    expect(html).toContain('w-full');
    expect(html).not.toContain('bg-slate-900');
  });
});
