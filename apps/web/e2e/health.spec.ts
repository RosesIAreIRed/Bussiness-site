import { expect, test } from '@playwright/test';
import { healthReportSchema } from '@ormilo/contracts';

test('GET /api/health віддає валідний HealthReport', async ({ request }) => {
  const response = await request.get('/api/health');

  // 200 — інфраструктура запущена, 503 — деградація (наприклад, БД недоступна).
  // Ендпоінт зобовʼязаний відповідати валідним звітом в обох випадках.
  expect([200, 503]).toContain(response.status());

  const report = healthReportSchema.parse(await response.json());
  expect(report.service).toBe('web');
  expect(report.components.map((component) => component.name).sort()).toEqual([
    'database',
    'redis',
  ]);
});

test('головна сторінка рендериться зі статусом milestones', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ormilo Growth OS' })).toBeVisible();
  await expect(page.getByRole('link', { name: '/api/health' })).toBeVisible();
  await expect(page.getByText('M0')).toBeVisible();
});
