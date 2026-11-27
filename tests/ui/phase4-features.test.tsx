// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import { App } from '../../src/ui/App.js';

afterEach(() => {
  cleanup();
});

function createTestService(tag = 'test'): TournamentService {
  let seq = 1;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${tag}-${seq++}`,
    nowIso: () => '2026-11-27T13:20:00.000Z',
    nowUtcMs: () => 1_700_000_000_000
  });
}

describe('Fase 4 UI Features (TDD — Delete with confirmation, Backup/Restore, Projection, Stats & PDF)', () => {
  it('deletes an in-progress tournament only after explicit modal confirmation', async () => {
    const user = userEvent.setup();
    const service = createTestService();

    const active = await service.createDraft('Copa Activa Borrable');
    await service.addParticipantsBulk(active.id, 'A\nB\nC\nD');
    await service.confirmAndStartTournament(active.id);

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);
    expect(await view.findByText('Copa Activa Borrable')).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Eliminar Copa Activa Borrable/i }));
    const dialog = await view.findByRole('dialog');
    expect(within(dialog).getByText(/¿Eliminar torneo\?/i)).toBeInTheDocument();

    // Cancel keeps the tournament
    await user.click(within(dialog).getByRole('button', { name: /Cancelar/i }));
    expect(view.queryByRole('dialog')).not.toBeInTheDocument();
    expect(view.getByText('Copa Activa Borrable')).toBeInTheDocument();

    // Confirm deletes it permanently
    await user.click(view.getByRole('button', { name: /Eliminar Copa Activa Borrable/i }));
    const dialog2 = await view.findByRole('dialog');
    await user.click(within(dialog2).getByRole('button', { name: /Sí, eliminar/i }));

    expect(await view.findByText(/Todavía no hay torneos creados/i)).toBeInTheDocument();
  });

  it('validates and restores a JSON backup from HomeScreen without losing existing tournaments', async () => {
    const user = userEvent.setup();
    const sourceService = createTestService('src');
    const exportedDraft = await sourceService.createDraft('Torneo Exportado');
    await sourceService.addParticipantsBulk(exportedDraft.id, 'J1\nJ2\nJ3\nJ4');
    const backup = await sourceService.exportBackupPayload();

    const targetService = createTestService('dst');
    await targetService.createDraft('Torneo Local Previo');

    const view = render(<App service={targetService} runtimeLabel="Entorno de pruebas" initialLocale="es" />);
    expect(await view.findByText('Torneo Local Previo')).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Respaldo local/i }));
    const dialog = await view.findByRole('dialog');
    const jsonBox = within(dialog).getByLabelText(/Pegar respaldo JSON/i);

    // Invalid JSON shows error without corrupting state
    fireEvent.change(jsonBox, { target: { value: '{not-valid' } });
    await user.click(within(dialog).getByRole('button', { name: /Restaurar respaldo/i }));
    expect(within(dialog).getByText(/JSON inválido/i)).toBeInTheDocument();

    // Valid backup imports Torneo Exportado alongside Torneo Local Previo
    fireEvent.change(jsonBox, { target: { value: JSON.stringify(backup) } });
    await user.click(within(dialog).getByRole('button', { name: /Restaurar respaldo/i }));

    expect(await within(dialog).findByText(/1 importado/i)).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole('button', { name: /Cerrar/i })[0]!);

    expect(await view.findByText('Torneo Exportado')).toBeInTheDocument();
    expect(view.getByText('Torneo Local Previo')).toBeInTheDocument();
  });

  it('opens fullscreen Projection Mode from active tournament and returns cleanly', async () => {
    const user = userEvent.setup();
    const service = createTestService();

    const trn = await service.createDraft('Copa Proyectada');
    await service.addParticipantsBulk(trn.id, 'P1\nP2\nP3\nP4\nP5\nP6\nP7\nP8');
    await service.confirmAndStartTournament(trn.id);

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);
    await user.click(await view.findByRole('button', { name: /Continuar torneo/i }));

    await user.click(await view.findByRole('button', { name: /Modo proyección/i }));
    expect(await view.findByRole('button', { name: /Salir de proyección/i })).toBeInTheDocument();
    expect(view.getAllByText('25:00').length).toBeGreaterThanOrEqual(2);
    expect(view.getAllByText(/Mesa 1/i).length).toBeGreaterThan(0);

    await user.click(view.getByRole('button', { name: /Salir de proyección/i }));
    expect(view.queryByRole('button', { name: /Salir de proyección/i })).not.toBeInTheDocument();
  });

  it('displays tournament statistics and PDF download buttons on completed tournament screen', async () => {
    const user = userEvent.setup();
    const service = createTestService();

    const trn = await service.createDraft('Copa Estadísticas');
    await service.addParticipantsBulk(trn.id, 'A\nB\nC\nD');
    await service.updateConfig(trn.id, { format: 'rounds_all_play' }, 1);
    await service.confirmAndStartTournament(trn.id);
    await service.simulateCurrentRoundResults(trn.id);
    await service.completeRoundAndAdvance(trn.id);

    const view = render(<App service={service} runtimeLabel="Entorno de pruebas" initialLocale="es" />);
    await user.click(await view.findByRole('button', { name: /Ver resumen/i }));

    expect(await view.findByText(/Estadísticas del torneo/i)).toBeInTheDocument();
    expect(view.getByText(/Partidas jugadas/i)).toBeInTheDocument();
    expect(view.getByText(/Puntos totales/i)).toBeInTheDocument();
    expect(view.getByText(/Mayor margen/i)).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Descargar reporte PDF/i })).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Descargar reglamento PDF/i })).toBeInTheDocument();
  });
});
