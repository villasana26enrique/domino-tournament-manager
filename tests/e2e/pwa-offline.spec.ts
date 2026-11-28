import { expect, test } from '@playwright/test';

test.describe('PWA Installability, SEO/OG Assets & Real Offline Mode', () => {
  test('serves valid PWA manifest, service worker, icons, SEO tags and works completely offline', async ({
    page,
    context
  }) => {
    await page.goto('/');

    // 1. SEO, Open Graph & JSON-LD checks
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /domino tournament/i
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og-card\.png$/
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#065f46');
    const jsonLdText = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLdText).toContain('SoftwareApplication');

    // 2. Static PWA & SEO assets return HTTP 200
    for (const assetPath of [
      '/manifest.webmanifest',
      '/sw.js',
      '/favicon.svg',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/apple-touch-icon.png',
      '/og-card.png',
      '/robots.txt',
      '/sitemap.xml'
    ]) {
      const response = await page.request.get(assetPath);
      expect(response.status(), `Expected 200 for ${assetPath}`).toBe(200);
    }

    const manifestResp = await page.request.get('/manifest.webmanifest');
    const manifestJson = (await manifestResp.json()) as {
      name: string;
      display: string;
      icons: Array<{ sizes: string }>;
    };
    expect(manifestJson.name).toBe('Domino Tournament Manager');
    expect(manifestJson.display).toBe('standalone');
    expect(manifestJson.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(manifestJson.icons.some((i) => i.sizes === '512x512')).toBe(true);

    // 3. Wait for Service Worker registration & control
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    // Reload once online to guarantee active SW controller if needed, then go 100% offline
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByText('Run your domino tournament in minutes')).toBeVisible();

      // Creating a tournament works completely offline from Service Worker cache + localStorage
      await page.getByPlaceholder('e.g. Saturday Club Cup').fill('Offline PWA Cup');
      await page.getByRole('button', { name: 'Create tournament' }).click();
      await expect(page.getByText('Offline PWA Cup')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});
