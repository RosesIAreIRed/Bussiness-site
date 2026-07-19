import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from '../src/app/page';

describe('HomePage', () => {
  it('рендерить назву системи, milestones і посилання на health', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('Ormilo Growth OS');
    expect(html).toContain('/api/health');
    expect(html).toContain('M0');
    expect(html).toContain('M6');
  });
});
