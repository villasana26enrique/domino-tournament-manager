import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const localPrivateKeyPath = path.resolve('.keys/ed25519-private.pem');
const hasLocalPrivateKey = fs.existsSync(localPrivateKeyPath);

test.describe('Pro Licensing, Club Branding & Free >16 Gate (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  });

  test('enforces 16-player Free limit cleanly, rejects forged keys, and gates Share PNG Card', async ({
    page
  }) => {
    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('Free Limit E2E');
    await page.getByRole('button', { name: 'Create tournament' }).click();

    // 25 players sample exceeds Free 16-player limit -> opens Pro modal without adding players
    await page.getByRole('button', { name: /25 players/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/exceed the 16-player Free limit/i)).toBeVisible();

    await dialog.getByLabel(/Paste your signed Pro key/i).fill('FORGED-INVALID-KEY');
    await dialog.getByRole('button', { name: 'Activate Pro' }).click();
    await expect(dialog.getByText(/Invalid key format/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close Pro modal' }).click();

    // 16 players still works 100% free & complete to Completed screen -> Share PNG Card gated
    await page.getByRole('button', { name: '16 players' }).click();
    await expect(page.getByText(/Free limit of 16 players reached/i)).toBeVisible();
    await page.getByRole('button', { name: 'Generate tournament' }).click();
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    // Play 1 quick round under Fixed Rounds? Use quick completed 4-player flow after finishing setup:
    // Actually finish Fixed Rounds until Completed screen or verify Share Card button from a 4-player tournament
    await page.getByRole('button', { name: 'Exit to home' }).click();
    await page.getByRole('button', { name: 'Yes, exit to home' }).click();

    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('Mini Free Cup');
    await page.getByRole('button', { name: 'Create tournament' }).click();
    await page.getByLabel('Paste player list').fill('A\nB\nC\nD');
    await page.getByRole('button', { name: 'Add list' }).click();
    await page.getByRole('button', { name: 'Generate tournament' }).click();
    await page.locator('select').nth(2).selectOption('3');
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    for (let r = 0; r < 3; r += 1) {
      await page.getByRole('button', { name: /Simulate results/i }).click();
      const finishBtn = page.getByRole('button', { name: 'Finish tournament' });
      if ((await finishBtn.count()) > 0) {
        await finishBtn.click();
        break;
      }
      await page.getByRole('button', { name: 'Close round & advance' }).click();
    }

    await page.getByRole('button', { name: /Share WhatsApp Card \(PNG\)/i }).click();
    await expect(
      page.getByRole('dialog').getByText(/WhatsApp Champion Card PNG export is included in Pro/i)
    ).toBeVisible();
  });

  test('activates real signed Ed25519 key across reload, unlocks 20 players, and renders Club Branding on TV', async ({
    page
  }) => {
    test.skip(!hasLocalPrivateKey, 'Requires local .keys/ed25519-private.pem to mint a real signature');

    const realKey = execFileSync(
      process.execPath,
      [path.resolve('scripts/issue-license.mjs'), '--name', 'Enrique Villasana', '--raw'],
      { encoding: 'utf8' }
    ).trim();

    await page.getByRole('button', { name: 'Get Pro ($10)', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Paste your signed Pro key/i).fill(realKey);
    await dialog.getByRole('button', { name: 'Activate Pro' }).click();

    await expect(dialog.getByText(/Pro unlocked! Licensed to Enrique Villasana/i)).toBeVisible();

    await dialog.getByLabel('Name', { exact: true }).fill('Club Vecinos');
    await dialog.getByRole('button', { name: 'Save branding' }).click();
    await expect(dialog.getByText(/Club branding saved/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close Pro modal' }).click();

    // Reload browser -> Ed25519 signature re-verifies automatically offline and stays Pro
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pro', exact: true })).toBeVisible();

    // Create 20-player tournament -> unlocked cleanly under Pro
    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('Pro Club Open');
    await page.getByRole('button', { name: 'Create tournament' }).click();
    const twenty = Array.from({ length: 20 }, (_, idx) => `Player ${idx + 1}`).join('\n');
    await page.getByLabel('Paste player list').fill(twenty);
    await page.getByRole('button', { name: 'Add list' }).click();
    await expect(page.getByText('Player 20')).toBeVisible();

    await page.getByRole('button', { name: 'Generate tournament' }).click();
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    await page.getByRole('button', { name: 'Projection mode' }).click();
    await expect(page.getByText('Club Vecinos')).toBeVisible();
    await page.getByRole('button', { name: 'Exit projection' }).click();
  });
});
