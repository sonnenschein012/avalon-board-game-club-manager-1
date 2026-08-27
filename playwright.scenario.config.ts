import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/scenario-lab',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run scenario-lab',
    url: 'http://127.0.0.1:5174/design.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
