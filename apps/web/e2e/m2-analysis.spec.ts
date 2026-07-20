import { expect, test } from '@playwright/test';

/**
 * M2-сценарій: аналіз кандидата фоновим worker-ом (mock AI).
 * Потребує БД + Redis + запущеного worker-а (другий webServer у конфігурації),
 * тому вмикається прапорцем E2E_DB=1.
 */
const E2E_DB = process.env.E2E_DB === '1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@ormilo.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ormilo-admin-dev';

test.describe('M2 product intelligence', () => {
  test.skip(!E2E_DB, 'потрібна БД і worker: запустіть із E2E_DB=1 після міграцій і seed');

  test('аналіз кандидата: score, рішення і детальний звіт', async ({ page }) => {
    test.setTimeout(120_000);
    const title = `E2E Аналіз ${Date.now()}`;

    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Кандидат із сирими даними для pricing/scoring
    await page.goto('/research');
    await page.getByLabel('Назва товару *').fill(title);
    await page.getByRole('button', { name: 'Додати кандидата' }).click();
    const row = page.locator('tr', { hasText: title });
    await expect(row).toBeVisible();

    // Запуск аналізу
    await row.getByRole('button', { name: 'Аналізувати' }).click();
    await expect(page).toHaveURL(/analyzing=1/);

    // Worker обробляє асинхронно (outbox кожні 5с): чекаємо появи score
    await expect(async () => {
      await page.goto('/research');
      const scoreCell = page.locator('tr', { hasText: title }).locator('td').nth(2);
      await expect(scoreCell).toHaveText(/^\d+$/, { timeout: 2_000 });
    }).toPass({ timeout: 60_000, intervals: [3_000] });

    // Детальна сторінка з повним звітом
    await page.locator('tr', { hasText: title }).getByRole('link', { name: title }).click();
    await expect(page.getByText(/Score: \d+\/100/)).toBeVisible();
    await expect(page.getByText('Compliance Guard (ТЗ §15)')).toBeVisible();
    await expect(page.getByText('Product Intelligence Brief (ТЗ §14)')).toBeVisible();
    await expect(page.getByText('Кути та hooks')).toBeVisible();
  });
});
