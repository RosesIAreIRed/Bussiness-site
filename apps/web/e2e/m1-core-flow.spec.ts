import { expect, test } from '@playwright/test';

/**
 * Наскрізний M1-сценарій (ТЗ §22): login → кандидат → approval → продукт → audit.
 * Потребує живої інфраструктури (PostgreSQL + міграції + seed), тому вмикається
 * прапорцем E2E_DB=1 (у CI — job із services; локально — docker compose up).
 */
const E2E_DB = process.env.E2E_DB === '1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@ormilo.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ormilo-admin-dev';

test.describe('M1 core flow', () => {
  test.skip(!E2E_DB, 'потрібна БД: запустіть із E2E_DB=1 після міграцій і seed');
  test.describe.configure({ mode: 'serial' });

  const candidateTitle = `E2E Кандидат ${Date.now()}`;

  test('захищені сторінки редіректять на /login без сесії', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('логін із seed-креденшелами веде на dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Увійти' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('невірний пароль показує помилку', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Увійти' }).click();

    await expect(page).toHaveURL(/error=credentials/);
    await expect(page.getByText('Невірний email або пароль.')).toBeVisible();
  });

  test('повний цикл: кандидат → approval → продукт → audit', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Створити кандидата
    await page.goto('/research');
    await page.getByLabel('Назва товару *').fill(candidateTitle);
    await page.getByRole('button', { name: 'Додати кандидата' }).click();
    await expect(page.getByText(candidateTitle)).toBeVisible();

    // Запросити approval на створення продукту
    const candidateRow = page.locator('tr', { hasText: candidateTitle });
    await candidateRow.getByRole('button', { name: 'Approval на продукт' }).click();
    await expect(page).toHaveURL(/requested=1/);

    // Затвердити
    await page.goto('/approvals');
    const approvalItem = page
      .locator('li', { hasText: 'CREATE_PRODUCT_FROM_CANDIDATE' })
      .first();
    await approvalItem.getByPlaceholder('Коментар (необовʼязково)').fill('E2E затвердження');
    await approvalItem.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(/decided=1/);

    // Продукт створено
    await page.goto('/products');
    await expect(page.getByText(candidateTitle)).toBeVisible();

    // Audit log містить ланцюжок дій
    await page.goto('/audit');
    await expect(page.getByText('candidate.created').first()).toBeVisible();
    await expect(page.getByText('approval.approved').first()).toBeVisible();
    await expect(page.getByText('product.created-from-candidate').first()).toBeVisible();
  });
});
