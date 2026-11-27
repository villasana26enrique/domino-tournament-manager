import { expect, test } from '@playwright/test';

test.describe('Domino Tournament Manager — E2E Fase 5', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  });

  test('runs full qualifying_elimination flow with visual bracket and live projection', async ({
    page
  }) => {
    await page.getByPlaceholder('Ej. Copa Vecinos del Sábado').fill('Copa E2E Llave');
    await page.getByRole('button', { name: 'Crear torneo' }).click();

    await page
      .getByLabel('Pegar lista de jugadores')
      .fill('Jugador 1\nJugador 2\nJugador 3\nJugador 4\nJugador 5\nJugador 6');
    await page.getByRole('button', { name: 'Agregar lista' }).click();
    await page.getByRole('button', { name: 'Generar torneo' }).click();
    await page.getByRole('button', { name: 'Confirmar e iniciar torneo' }).click();

    // Llave tab is visible in qualifying_elimination
    const bracketTab = page.getByRole('button', { name: 'Llave', exact: true });
    await expect(bracketTab).toBeVisible();
    await bracketTab.click();
    await expect(page.getByText(/Zona de clasificación \(Top 4\)/i)).toBeVisible();

    // Advance R1 -> R2 -> Gran Final
    await page.getByRole('button', { name: 'Mesas y resultados' }).click();
    await page.getByRole('button', { name: /Simular resultados/i }).click();
    await page.getByRole('button', { name: 'Cerrar ronda y avanzar' }).click();

    await page.getByRole('button', { name: /Simular resultados/i }).click();
    await page.getByRole('button', { name: 'Cerrar ronda y avanzar' }).click();

    // Gran Final shown in bracket + ProjectionView live bracket toggle
    await bracketTab.click();
    await expect(page.getByText(/Clasificados a Gran Final/i)).toBeVisible();

    await page.getByRole('button', { name: 'Modo proyección' }).click();
    await page.getByRole('button', { name: 'Llave en vivo' }).click();
    await expect(page.getByRole('heading', { name: 'Gran Final' }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Salir de proyección' }).click();

    // Finalize Gran Final -> Completed screen shows Champion & Llave del torneo
    await page.getByRole('button', { name: 'Mesas y resultados' }).click();
    await page.getByRole('button', { name: /Simular resultados/i }).click();
    await page.getByRole('button', { name: 'Finalizar torneo' }).click();

    await expect(page.getByText(/Torneo finalizado/i)).toBeVisible();
    await expect(page.getByText(/Llave del torneo/i)).toBeVisible();
  });

  test('hides visual bracket in rounds_all_play and guards accidental exit', async ({ page }) => {
    await page.getByPlaceholder('Ej. Copa Vecinos del Sábado').fill('Torneo Rondas E2E');
    await page.getByRole('button', { name: 'Crear torneo' }).click();

    await page
      .getByLabel('Pegar lista de jugadores')
      .fill('P1\nP2\nP3\nP4\nP5\nP6\nP7\nP8');
    await page.getByRole('button', { name: 'Agregar lista' }).click();
    await page.getByRole('button', { name: 'Generar torneo' }).click();

    await page.getByRole('button', { name: /Por rondas/i }).click();
    await page.getByRole('button', { name: 'Confirmar e iniciar torneo' }).click();

    await expect(page.getByRole('button', { name: 'Mesas y resultados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Llave', exact: true })).toHaveCount(0);

    // Leave guard modal protects active tournament exit
    await page.getByRole('button', { name: 'Salir al inicio' }).click();
    await expect(page.getByText('¿Salir de la vista del torneo?')).toBeVisible();
    await page.getByRole('button', { name: 'Seguir en el torneo' }).click();
    await expect(page.getByRole('button', { name: 'Mesas y resultados' })).toBeVisible();

    await page.getByRole('button', { name: 'Salir al inicio' }).click();
    await page.getByRole('button', { name: 'Sí, salir al inicio' }).click();
    await expect(page.getByText('Torneo Rondas E2E')).toBeVisible();
  });

  test('enforces local Organizer PIN lock across sessions and protects sensitive actions', async ({
    page
  }) => {
    await page.getByPlaceholder('Ej. Copa Vecinos del Sábado').fill('Torneo PIN E2E');
    await page.getByRole('button', { name: 'Crear torneo' }).click();
    await page.getByLabel('Pegar lista de jugadores').fill('A\nB\nC\nD');
    await page.getByRole('button', { name: 'Agregar lista' }).click();
    await page.getByRole('button', { name: 'Generar torneo' }).click();
    await page.getByRole('button', { name: 'Confirmar e iniciar torneo' }).click();

    // Setup PIN 2468 from top bar
    await page.getByRole('button', { name: /Proteger con PIN|^PIN$/i }).click();
    await page.getByLabel(/Nuevo PIN/i).fill('2468');
    await page.getByLabel(/Confirmar PIN/i).fill('2468');
    await page.getByRole('button', { name: 'Guardar y bloquear' }).click();

    await expect(page.getByRole('button', { name: 'Bloqueado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Simular resultados/i })).toHaveCount(0);

    // Exit to home -> try Delete while locked
    await page.getByRole('button', { name: 'Salir al inicio' }).click();
    await page.getByRole('button', { name: 'Sí, salir al inicio' }).click();

    await page.getByRole('button', { name: 'Eliminar Torneo PIN E2E' }).click();
    await page.getByLabel(/Ingresa el PIN/i).fill('0000');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByText(/PIN incorrecto/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Reload preserves PIN lock automatically
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bloqueado' })).toBeVisible();

    // Unlock and remove PIN cleanly, then delete tournament
    await page.getByRole('button', { name: 'Bloqueado' }).click();
    await page.getByLabel(/Ingresa el PIN/i).fill('2468');
    await page.getByRole('button', { name: 'Desbloquear' }).click();

    await expect(page.getByRole('button', { name: 'Organizador' })).toBeVisible();
    await page.getByRole('button', { name: 'Organizador' }).click();
    await page.getByLabel(/PIN actual para confirmar/i).fill('2468');
    await page.getByRole('button', { name: 'Quitar PIN' }).click();

    await expect(page.getByRole('button', { name: /Proteger con PIN|^PIN$/i })).toBeVisible();

    await page.getByRole('button', { name: 'Eliminar Torneo PIN E2E' }).click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page.getByText(/Todavía no hay torneos creados/i)).toBeVisible();
  });
});
