import { defineConfig } from '@playwright/test';

process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1425',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--no-proxy-server']
    }
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:1425',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    stdout: 'pipe',
    stderr: 'pipe'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 }
      }
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
