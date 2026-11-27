// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import { ORGANIZER_PIN_STORAGE_KEY } from '../../src/infrastructure/organizer-pin.js';
import { App } from '../../src/ui/App.js';

beforeEach(() => {
  window.localStorage.removeItem(ORGANIZER_PIN_STORAGE_KEY);
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(ORGANIZER_PIN_STORAGE_KEY);
});

function createTestService(tag = 'p5'): TournamentService {
  let seq = 1;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${tag}-${seq++}`,
    nowIso: () => '2026-11-27T15:30:00.000Z',
    nowUtcMs: () => 1_700_000_000_000
  });
}

describe('Fase 5 UI (TDD — Llave visual por fases y PIN local de organizador)', () => {
  it('shows visual bracket ONLY for qualifying_elimination (Active, Projection, Completed) and hides it for rounds_all_play', async () => {
    const user = userEvent.setup();
    const service = createTestService('bracket');

    // 1. rounds_all_play (8 players): no Llave tab
    const roundsTrn = await service.createDraft('Torneo Por Rondas');
    await service.addParticipantsBulk(roundsTrn.id, 'R1\nR2\nR3\nR4\nR5\nR6\nR7\nR8');
    await service.updateConfig(roundsTrn.id, { format: 'rounds_all_play' });
    await service.confirmAndStartTournament(roundsTrn.id);

    // 2. qualifying_elimination (6 players -> Gran Final Top 4)
    const elimTrn = await service.createDraft('Copa Llave Visual');
    await service.addParticipantsBulk(elimTrn.id, 'E1\nE2\nE3\nE4\nE5\nE6');
    await service.updateConfig(elimTrn.id, { format: 'qualifying_elimination' });
    await service.confirmAndStartTournament(elimTrn.id);

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" />);

    // Open rounds_all_play tournament -> must NOT show Llave tab
    const roundsHeading = await view.findByText('Torneo Por Rondas');
    const roundsCard = roundsHeading.closest('article') ?? view.container;
    await user.click(within(roundsCard as HTMLElement).getByRole('button', { name: /Continuar torneo/i }));

    expect(view.getByRole('button', { name: /Mesas y resultados/i })).toBeInTheDocument();
    expect(view.queryByRole('button', { name: /^Llave$/i })).not.toBeInTheDocument();

    // Return home cleanly via LeaveTournamentModal
    await user.click(view.getByRole('button', { name: /Salir al inicio/i }));
    await user.click(within(await view.findByRole('dialog')).getByRole('button', { name: /Sí, salir al inicio/i }));

    // Open qualifying_elimination tournament -> MUST show Llave tab
    const elimCard = (await view.findByText('Copa Llave Visual')).closest('article') ?? view.container;
    await user.click(within(elimCard as HTMLElement).getByRole('button', { name: /Continuar torneo/i }));

    const bracketTab = view.getByRole('button', { name: /^Llave$/i });
    expect(bracketTab).toBeInTheDocument();
    await user.click(bracketTab);

    expect(view.getByText(/Zona de clasificación \(Top 4\)/i)).toBeInTheDocument();
    expect(view.getAllByText(/Por definir/i).length).toBeGreaterThan(0);

    // Advance R1 & R2 to reach Gran Final
    await user.click(view.getByRole('button', { name: /Mesas y resultados/i }));
    await user.click(view.getByRole('button', { name: /Simular resultados/i }));
    await user.click(view.getByRole('button', { name: /Cerrar ronda y avanzar/i }));

    await user.click(view.getByRole('button', { name: /Simular resultados/i }));
    await user.click(view.getByRole('button', { name: /Cerrar ronda y avanzar/i }));

    // Now in Gran Final -> check Llave tab & ProjectionView Llave toggle
    await user.click(view.getByRole('button', { name: /^Llave$/i }));
    expect(view.getByText(/Clasificados a Gran Final/i)).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Modo proyección/i }));
    await user.click(view.getByRole('button', { name: /Llave en vivo/i }));
    expect(view.getAllByText(/Ruta a la Final/i).length).toBe(2);
    await user.click(view.getByRole('button', { name: /Salir de proyección/i }));

    // Finish Gran Final -> CompletedTournamentScreen shows Llave del torneo
    await user.click(view.getByRole('button', { name: /Mesas y resultados/i }));
    await user.click(view.getByRole('button', { name: /Simular resultados/i }));
    await user.click(view.getByRole('button', { name: /Finalizar torneo/i }));

    expect((await view.findAllByText(/Campeón Individual/i)).length).toBeGreaterThan(0);
    expect(view.getByText(/Llave del torneo/i)).toBeInTheDocument();
  });

  it('protects simulation, match corrections, contingencies and tournament deletion with Organizer PIN', async () => {
    const user = userEvent.setup();
    const service = createTestService('pin');

    const trn = await service.createDraft('Torneo Protegido');
    await service.addParticipantsBulk(trn.id, 'P1\nP2\nP3\nP4\nP5\nP6\nP7\nP8');
    await service.confirmAndStartTournament(trn.id);

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" />);
    expect(await view.findByText('Torneo Protegido')).toBeInTheDocument();

    // Configure PIN 2468 from header -> automatically locks organizer mode
    await user.click(view.getByRole('button', { name: /Proteger con PIN/i }));
    const setupDialog = await view.findByRole('dialog');
    await user.type(within(setupDialog).getByLabelText(/Nuevo PIN/i), '2468');
    await user.type(within(setupDialog).getByLabelText(/Confirmar PIN/i), '2468');
    await user.click(within(setupDialog).getByRole('button', { name: /Guardar y bloquear/i }));

    expect(await view.findByRole('button', { name: /Bloqueado/i })).toBeInTheDocument();

    // Clicking Delete while locked prompts for PIN first (wrong PIN fails, right PIN unlocks and opens Delete modal)
    await user.click(view.getByRole('button', { name: /Eliminar Torneo Protegido/i }));
    const unlockDialog = await view.findByRole('dialog');
    expect(
      within(unlockDialog).getByRole('heading', { name: /PIN de organizador/i })
    ).toBeInTheDocument();

    await user.type(within(unlockDialog).getByLabelText(/Ingresa el PIN/i), '0000');
    await user.click(within(unlockDialog).getByRole('button', { name: /Desbloquear/i }));
    expect(within(unlockDialog).getByText(/PIN incorrecto/i)).toBeInTheDocument();

    const pinInput = within(unlockDialog).getByLabelText(/Ingresa el PIN/i);
    await user.clear(pinInput);
    await user.type(pinInput, '2468');
    await user.click(within(unlockDialog).getByRole('button', { name: /Desbloquear/i }));

    // Delete modal should now appear -> cancel it
    const deleteDialog = await view.findByRole('dialog');
    expect(within(deleteDialog).getByText(/¿Eliminar torneo\?/i)).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole('button', { name: /Cancelar/i }));

    // Re-lock organizer mode from header
    await user.click(view.getByRole('button', { name: /Organizador/i }));
    const manageDialog = await view.findByRole('dialog');
    await user.click(within(manageDialog).getByRole('button', { name: /Bloquear ahora/i }));

    // Enter active tournament while locked -> Simular resultados (Prueba) must be hidden
    await user.click(view.getByRole('button', { name: /Continuar torneo/i }));
    expect(view.queryByRole('button', { name: /Simular resultados/i })).not.toBeInTheDocument();

    // Contingency Retirar requires PIN unlock while locked
    await user.click(view.getByRole('button', { name: /Participantes/i }));
    await user.click(view.getAllByRole('button', { name: /^Retirar$/i })[0]!);
    const guardDialog = await view.findByRole('dialog');
    expect(
      within(guardDialog).getByRole('heading', { name: /PIN de organizador/i })
    ).toBeInTheDocument();
    await user.type(within(guardDialog).getByLabelText(/Ingresa el PIN/i), '2468');
    await user.click(within(guardDialog).getByRole('button', { name: /Desbloquear/i }));

    // Now unlocked: Remove PIN completely via header manage modal
    await user.click(view.getByRole('button', { name: /Organizador/i }));
    const manageDialog2 = await view.findByRole('dialog');
    await user.type(within(manageDialog2).getByLabelText(/PIN actual para confirmar/i), '2468');
    await user.click(within(manageDialog2).getByRole('button', { name: /Quitar PIN/i }));

    expect(await view.findByRole('button', { name: /Proteger con PIN/i })).toBeInTheDocument();
  });
});
