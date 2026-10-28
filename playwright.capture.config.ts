import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/capture',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } },
    { name: 'webkit-ipad', use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: {
    command: 'npm run scenario-lab',
    url: 'http://127.0.0.1:5174/design.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
