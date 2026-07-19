import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * PW_CHROMIUM_EXECUTABLE — override для середовищ із попередньо
 * встановленим Chromium (несумісним за версією з реєстром Playwright).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
