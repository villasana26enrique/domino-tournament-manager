import { expect, test } from '@playwright/test';

test.describe('Domino Tournament Manager — E2E (EN primary + ES)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  });

  test('runs full qualifying_elimination flow in English with visual bracket and live projection', async ({
    page
  }) => {
    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('E2E Bracket Cup');
    await page.getByRole('button', { name: 'Create tournament' }).click();

    await page
      .getByLabel('Paste player list')
      .fill('Player 1\nPlayer 2\nPlayer 3\nPlayer 4\nPlayer 5\nPlayer 6');
    await page.getByRole('button', { name: 'Add list' }).click();
    await page.getByRole('button', { name: 'Generate tournament' }).click();
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    // Bracket tab is visible in qualifying_elimination
    const bracketTab = page.getByRole('button', { name: 'Bracket', exact: true });
    await expect(bracketTab).toBeVisible();
    await bracketTab.click();
    await expect(page.getByText(/Qualification zone \(Top 4\)/i)).toBeVisible();

    // Advance R1 -> R2 -> Grand Final
    await page.getByRole('button', { name: 'Tables & results' }).click();
    await page.getByRole('button', { name: /Simulate results/i }).click();
    await page.getByRole('button', { name: 'Close round & advance' }).click();

    await page.getByRole('button', { name: /Simulate results/i }).click();
    await page.getByRole('button', { name: 'Close round & advance' }).click();

    // Grand Final shown in bracket + ProjectionView live bracket toggle
    await bracketTab.click();
    await expect(page.getByText(/Qualified for Grand Final/i)).toBeVisible();

    await page.getByRole('button', { name: 'Projection mode' }).click();
    await page.getByRole('button', { name: 'Live bracket' }).click();
    await expect(page.getByRole('heading', { name: 'Grand Final' }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Exit projection' }).click();

    // Finalize Grand Final -> Completed screen shows Champion & Tournament Bracket
    await page.getByRole('button', { name: 'Tables & results' }).click();
    await page.getByRole('button', { name: /Simulate results/i }).click();
    await page.getByRole('button', { name: 'Finish tournament' }).click();

    await expect(page.getByText(/Tournament completed/i)).toBeVisible();
    await expect(page.getByText(/Tournament Bracket/i)).toBeVisible();
  });

  test('hides visual bracket in rounds_all_play and guards accidental exit', async ({ page }) => {
    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('Rounds All Play E2E');
    await page.getByRole('button', { name: 'Create tournament' }).click();

    await page
      .getByLabel('Paste player list')
      .fill('P1\nP2\nP3\nP4\nP5\nP6\nP7\nP8');
    await page.getByRole('button', { name: 'Add list' }).click();
    await page.getByRole('button', { name: 'Generate tournament' }).click();

    await page.getByRole('button', { name: /Fixed Rounds/i }).click();
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    await expect(page.getByRole('button', { name: 'Tables & results' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bracket', exact: true })).toHaveCount(0);

    // Leave guard modal protects active tournament exit
    await page.getByRole('button', { name: 'Exit to home' }).click();
    await expect(page.getByText('Exit active tournament view?')).toBeVisible();
    await page.getByRole('button', { name: 'Stay in tournament' }).click();
    await expect(page.getByRole('button', { name: 'Tables & results' })).toBeVisible();

    await page.getByRole('button', { name: 'Exit to home' }).click();
    await page.getByRole('button', { name: 'Yes, exit to home' }).click();
    await expect(page.getByText('Rounds All Play E2E')).toBeVisible();
  });

  test('enforces local Organizer PIN lock across sessions and protects sensitive actions', async ({
    page
  }) => {
    await page.getByPlaceholder('e.g. Saturday Club Cup').fill('PIN Protected E2E');
    await page.getByRole('button', { name: 'Create tournament' }).click();
    await page.getByLabel('Paste player list').fill('A\nB\nC\nD');
    await page.getByRole('button', { name: 'Add list' }).click();
    await page.getByRole('button', { name: 'Generate tournament' }).click();
    await page.getByRole('button', { name: 'Confirm & start tournament' }).click();

    // Setup PIN 2468 from top bar
    await page.getByRole('button', { name: /Protect with PIN|^PIN$/i }).click();
    await page.getByLabel(/New PIN/i).fill('2468');
    await page.getByLabel(/Confirm PIN/i).fill('2468');
    await page.getByRole('button', { name: 'Save & lock' }).click();

    await expect(page.getByRole('button', { name: 'Locked' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Simulate results/i })).toHaveCount(0);

    // Exit to home -> try Delete while locked
    await page.getByRole('button', { name: 'Exit to home' }).click();
    await page.getByRole('button', { name: 'Yes, exit to home' }).click();

    await page.getByRole('button', { name: 'Delete PIN Protected E2E' }).click();
    await page.getByLabel(/Enter PIN/i).fill('0000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText(/Incorrect PIN/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Reload preserves PIN lock automatically
    await page.reload();
    await expect(page.getByRole('button', { name: 'Locked' })).toBeVisible();

    // Unlock and remove PIN cleanly, then delete tournament
    await page.getByRole('button', { name: 'Locked' }).click();
    await page.getByLabel(/Enter PIN/i).fill('2468');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page.getByRole('button', { name: 'Organizer' })).toBeVisible();
    await page.getByRole('button', { name: 'Organizer' }).click();
    await page.getByLabel(/Current PIN/i).fill('2468');
    await page.getByRole('button', { name: 'Remove PIN' }).click();

    await expect(page.getByRole('button', { name: /Protect with PIN|^PIN$/i })).toBeVisible();

    await page.getByRole('button', { name: 'Delete PIN Protected E2E' }).click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText(/No tournaments created yet/i)).toBeVisible();
  });

  test('switches EN <-> ES persistently and auto-detects Spanish browser locale', async ({
    page,
    browser
  }) => {
    await expect(page.getByText('Run your domino tournament in minutes')).toBeVisible();

    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await expect(page.getByText('Organiza tu torneo de dominó en minutos')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Organiza tu torneo de dominó en minutos')).toBeVisible();

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByText('Run your domino tournament in minutes')).toBeVisible();

    // Separate Spanish-locale browser context auto-detects Spanish on first load
    const esContext = await browser.newContext({ locale: 'es-ES' });
    const esPage = await esContext.newPage();
    await esPage.goto('/');
    await expect(esPage.getByText('Organiza tu torneo de dominó en minutos')).toBeVisible();
    await expect(esPage.getByRole('button', { name: 'Crear torneo' })).toBeVisible();
    await esContext.close();
  });
});
