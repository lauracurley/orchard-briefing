import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        channel: process.env.CI ? undefined : 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
  },
});
