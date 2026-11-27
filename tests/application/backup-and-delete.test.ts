import { beforeEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';

describe('Delete Tournament & Backup/Restore (TDD — Phase 4)', () => {
  let repo: InMemoryTournamentRepository;
  let service: TournamentService;

  beforeEach(() => {
    let seq = 1;
    repo = new InMemoryTournamentRepository();
    service = new TournamentService({
      repository: repo,
      generateId: (prefix) => `${prefix}-${seq++}`,
      nowIso: () => '2026-11-27T13:10:00.000Z',
      nowUtcMs: () => 1_700_000_000_000
    });
  });

  it('deletes tournaments in draft, in_progress and completed states while keeping deleteDraft strict', async () => {
    const draft = await service.createDraft('Borrador 1');
    const active = await service.createDraft('Torneo Activo');
    await service.addParticipantsBulk(active.id, 'A\nB\nC\nD');
    await service.confirmAndStartTournament(active.id);

    const finished = await service.createDraft('Torneo Finalizado');
    await service.addParticipantsBulk(finished.id, 'A\nB\nC\nD');
    await service.updateConfig(finished.id, { format: 'rounds_all_play' }, 1);
    await service.confirmAndStartTournament(finished.id);
    await service.simulateCurrentRoundResults(finished.id);
    await service.completeRoundAndAdvance(finished.id);

    // deleteDraft must still block started tournaments
    await expect(service.deleteDraft(active.id)).rejects.toThrow(/borrador/i);

    // deleteTournament works on any valid tournament state
    await service.deleteTournament(draft.id);
    await service.deleteTournament(active.id);
    await service.deleteTournament(finished.id);

    expect(await service.listTournaments()).toHaveLength(0);
    await expect(service.deleteTournament('non-existent')).rejects.toThrow(/no se encontró/i);
  });

  it('exports valid backup JSON and restores/merges into another repository while rejecting malformed payloads', async () => {
    const t1 = await service.createDraft('Copa Vecinal');
    await service.addParticipantsBulk(t1.id, 'P1\nP2\nP3\nP4');
    await service.confirmAndStartTournament(t1.id);

    const backup = await service.exportBackupPayload();
    expect(backup.schemaVersion).toBe('1.0.0');
    expect(backup.app).toBe('Domino Tournament Manager');
    expect(backup.tournaments).toHaveLength(1);

    const targetRepo = new InMemoryTournamentRepository();
    const targetService = new TournamentService({
      repository: targetRepo,
      generateId: (prefix) => `${prefix}-target`,
      nowIso: () => '2026-11-27T13:15:00.000Z'
    });

    const existing = await targetService.createDraft('Torneo Previo Local');

    // Malformed JSON or invalid schema must throw DomainValidationError
    await expect(targetService.importBackupPayload('{invalid json')).rejects.toThrow(/inválido/i);
    await expect(
      targetService.importBackupPayload(JSON.stringify({ schemaVersion: '9.9.9', tournaments: [] }))
    ).rejects.toThrow(/respaldo/i);

    // Import into target -> imports t1 without deleting existing local tournament
    const summary1 = await targetService.importBackupPayload(JSON.stringify(backup));
    expect(summary1.importedCount).toBe(1);
    expect(summary1.updatedCount).toBe(0);
    expect(summary1.totalAfter).toBe(2);

    const allInTarget = await targetService.listTournaments();
    expect(allInTarget.map((t) => t.id)).toContain(t1.id);
    expect(allInTarget.map((t) => t.id)).toContain(existing.id);

    // Re-importing same tournament counts as updatedCount
    const summary2 = await targetService.importBackupPayload(JSON.stringify(backup));
    expect(summary2.importedCount).toBe(0);
    expect(summary2.updatedCount).toBe(1);
    expect(summary2.totalAfter).toBe(2);
  });
});
