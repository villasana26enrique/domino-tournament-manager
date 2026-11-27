// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
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
  let nowMs = 1_700_000_000_000;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${seq++}`,
    nowIso: () => new Date(nowMs).toISOString(),
    nowUtcMs: () => {
      nowMs += 1000;
      return nowMs;
    }
  });
}

async function seedAndStartSixPlayerElimination(
  user: ReturnType<typeof userEvent.setup>,
  service: TournamentService
) {
  const draft = await service.createDraft('Torneo Guardado');
  await service.addParticipantsBulk(
    draft.id,
    ['Carlos', 'María', 'José', 'Ana', 'Luis', 'Carmen'].join('\n')
  );
  await service.confirmAndStartTournament(draft.id);

  const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);
  const continueBtn = await view.findByRole('button', { name: /Continuar torneo/i });
  await user.click(continueBtn);
  return view;
}

describe('Fase 3 UI Flow (TDD — Leave Guard, Timer, Results, Audit & Champion)', () => {
  it('blocks accidental exit from an active tournament with a confirmation modal while reassuring auto-save', async () => {
    const user = userEvent.setup();
    const service = createTestService();
    const view = await seedAndStartSixPlayerElimination(user, service);

    // Active screen should show auto-save reassurance and timer controls
    expect(await view.findByText(/Guardado automático/i)).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Iniciar ronda/i })).toBeInTheDocument();

    // Clicking "Inicio" in top nav MUST NOT leave immediately — opens confirmation modal
    await user.click(view.getByRole('button', { name: /^Inicio$/i }));
    const dialog1 = await view.findByRole('dialog');
    expect(within(dialog1).getByText(/torneo sigue guardado/i)).toBeInTheDocument();

    // Stay in tournament
    await user.click(within(dialog1).getByRole('button', { name: /Seguir en el torneo/i }));
    expect(view.queryByRole('dialog')).not.toBeInTheDocument();
    expect(view.getByText(/Torneo Guardado/i)).toBeInTheDocument();

    // Clicking "Salir al inicio" opens guard again -> confirm exit
    await user.click(view.getByRole('button', { name: /Salir al inicio/i }));
    const dialog2 = await view.findByRole('dialog');
    await user.click(within(dialog2).getByRole('button', { name: /Sí, salir al inicio/i }));

    // Now on Home, tournament is still listed as "En curso" with "Continuar torneo"
    expect(await view.findByRole('button', { name: /Continuar torneo/i })).toBeInTheDocument();
  });

  it('runs timer, records time-draw & audited correction, advances 6-player elimination to Gran Final and shows Champion', async () => {
    const user = userEvent.setup();
    const service = createTestService();
    const view = await seedAndStartSixPlayerElimination(user, service);

    // 1. Timer controls: Iniciar ronda -> Pausar -> Reanudar
    await user.click(await view.findByRole('button', { name: /Iniciar ronda/i }));
    const pauseBtn = await view.findByRole('button', { name: /Pausar/i });
    await user.click(pauseBtn);
    expect(await view.findByRole('button', { name: /Reanudar/i })).toBeInTheDocument();

    // 2. Record a time-expired draw (64-64) on Mesa 1 manually
    await user.click(view.getByRole('button', { name: /Registrar resultado/i }));
    const modal1 = await view.findByRole('dialog');
    const scoreAInput = within(modal1).getByLabelText(/Puntos Pareja A/i);
    const scoreBInput = within(modal1).getByLabelText(/Puntos Pareja B/i);
    const endedBySelect = within(modal1).getByLabelText(/Motivo de cierre/i);

    await user.clear(scoreAInput);
    await user.type(scoreAInput, '64');
    await user.clear(scoreBInput);
    await user.type(scoreBInput, '64');
    await user.selectOptions(endedBySelect, 'time_expired');
    await user.click(within(modal1).getByRole('button', { name: /Confirmar resultado/i }));

    expect(await view.findByText(/Empate \(64 - 64\)/i)).toBeInTheDocument();

    // 3. Correct Mesa 1 administratively with required reason -> verify in Audit tab
    await user.click(view.getByRole('button', { name: /Corregir/i }));
    const modal2 = await view.findByRole('dialog');
    const corrA = within(modal2).getByLabelText(/Puntos Pareja A/i);
    const corrB = within(modal2).getByLabelText(/Puntos Pareja B/i);
    const reasonInput = within(modal2).getByLabelText(/Motivo de corrección/i);

    await user.clear(corrA);
    await user.type(corrA, '112');
    await user.clear(corrB);
    await user.type(corrB, '78');
    await user.selectOptions(within(modal2).getByLabelText(/Motivo de cierre/i), 'target_score');
    await user.type(reasonInput, 'Error de anotación corregido por mesa');
    await user.click(within(modal2).getByRole('button', { name: /Guardar corrección/i }));

    expect(await view.findByText(/112 - 78/)).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Reglamento y auditoría/i }));
    expect(
      await view.findByText(/Error de anotación corregido por mesa/i)
    ).toBeInTheDocument();

    // Return to tables tab and advance R1 (Clasificatoria 1) -> R2 (Clasificatoria 2) -> R3 (Gran Final)
    await user.click(view.getByRole('button', { name: /Mesas y resultados/i }));
    await user.click(await view.findByRole('button', { name: /Cerrar ronda y avanzar/i }));

    // Round 2: Clasificatoria 2 (Corte)
    expect((await view.findAllByText(/Clasificatoria 2/i)).length).toBeGreaterThan(0);
    await user.click(view.getByRole('button', { name: /Simular resultados/i }));
    await user.click(await view.findByRole('button', { name: /Cerrar ronda y avanzar/i }));

    // Round 3: Gran Final (1 table, 4 finalists)
    expect((await view.findAllByText(/Gran Final/i)).length).toBeGreaterThan(0);
    await user.click(view.getByRole('button', { name: /Simular resultados/i }));
    await user.click(await view.findByRole('button', { name: /Finalizar torneo/i }));

    // Completed Tournament Screen
    expect((await view.findAllByText(/Torneo finalizado/i)).length).toBeGreaterThan(0);
    expect(view.getAllByText(/Campeón Individual/i).length).toBeGreaterThan(0);
    expect(view.getByText(/Pareja Ganadora de la Final/i)).toBeInTheDocument();
  });
});
