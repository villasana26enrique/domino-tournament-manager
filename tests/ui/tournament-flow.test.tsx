// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import { App } from '../../src/ui/App.js';

afterEach(() => {
  cleanup();
});

function createTestService(): TournamentService {
  let seq = 1;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${seq++}`,
    nowIso: () => '2026-11-27T12:30:00.000Z'
  });
}

describe('Fase 2 UI Flow (TDD — Inicio, Registro, Previsualización y Modalidades)', () => {
  it('completes the full creation -> registration (15 vs 16) -> preview -> confirmation flow', async () => {
    const user = userEvent.setup();
    const service = createTestService();

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);

    // 1. Inicio screen -> create tournament
    expect(await view.findByText(/Domino Tournament Manager/i)).toBeInTheDocument();
    const nameInput = view.getByLabelText(/Nombre del torneo/i);
    await user.type(nameInput, 'Copa El Cafetal');
    await user.click(view.getByRole('button', { name: /Crear torneo/i }));

    // 2. Registro de participantes -> bulk add 15 players
    expect(await view.findByText(/Registro de participantes/i)).toBeInTheDocument();
    const bulkTextarea = view.getByLabelText(/Pegar lista de jugadores/i);
    const fifteenPlayers = Array.from({ length: 15 }, (_, i) => `Vecino ${i + 1}`).join('\n');
    await user.type(bulkTextarea, fifteenPlayers);
    await user.click(view.getByRole('button', { name: /Agregar lista/i }));

    expect(await view.findByText('Vecino 15')).toBeInTheDocument();
    await user.click(view.getByRole('button', { name: /Generar torneo/i }));

    // 3. Previsualización with 15 players -> Por rondas MUST be disabled, Eliminaciones active
    expect(await view.findByText(/Previsualización del torneo/i)).toBeInTheDocument();
    const roundsOption = view.getByRole('button', { name: /Por rondas/i });
    expect(roundsOption).toBeDisabled();
    expect(view.getAllByText(/Clasificatoria 1/i).length).toBeGreaterThan(0);
    expect(view.getAllByText(/Gran Final/i).length).toBeGreaterThan(0);
    expect(view.getByText(/sin muerte súbita/i)).toBeInTheDocument();

    // 4. Return to registration, add player #16 -> Por rondas becomes enabled!
    await user.click(view.getByRole('button', { name: /Editar participantes/i }));
    const singleInput = await view.findByLabelText(/Nombre del participante/i);
    await user.type(singleInput, 'Vecino 16');
    await user.click(view.getByRole('button', { name: /Añadir jugador/i }));
    expect(await view.findByText('Vecino 16')).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Generar torneo/i }));
    const enabledRoundsOption = await view.findByRole('button', { name: /Por rondas/i });
    expect(enabledRoundsOption).not.toBeDisabled();
    await user.click(enabledRoundsOption);

    // 5. Confirm and start tournament
    await user.click(view.getByRole('button', { name: /Confirmar e iniciar torneo/i }));
    expect(await view.findByText(/Torneo iniciado/i)).toBeInTheDocument();
    expect(view.getByText(/Mesa 4/i)).toBeInTheDocument();
    expect(view.getByText(/Reglamento oficial congelado/i)).toBeInTheDocument();
  });

  it('displays implemented vs planned modalities in the Modalidades y reglamentos screen', async () => {
    const user = userEvent.setup();
    const service = createTestService();

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);

    const navButton = (await view.findAllByRole('button', { name: /Modalidades y reglamentos/i }))[0]!;
    await user.click(navButton);
    expect(await view.findByText(/Implementada en el MVP/i)).toBeInTheDocument();
    expect(view.getByText(/Parejas fijas/i)).toBeInTheDocument();
    expect(view.getByText(/Próximamente/i)).toBeInTheDocument();
  });
});
