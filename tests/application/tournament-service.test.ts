import { beforeEach, describe, expect, it } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';

describe('TournamentService (TDD — Application Layer)', () => {
  let repo: InMemoryTournamentRepository;
  let service: TournamentService;

  beforeEach(() => {
    let seq = 1;
    repo = new InMemoryTournamentRepository();
    service = new TournamentService({
      repository: repo,
      generateId: (prefix) => `${prefix}-${seq++}`,
      nowIso: () => '2026-11-27T12:00:00.000Z'
    });
  });

  it('creates a draft tournament with trimmed name and rejects blank names', async () => {
    await expect(service.createDraft('   ')).rejects.toThrow(/nombre/i);

    const draft = await service.createDraft('  Copa Vecinos El Cafetal  ');
    expect(draft.id).toBe('trn-1');
    expect(draft.name).toBe('Copa Vecinos El Cafetal');
    expect(draft.status).toBe('draft');
    expect(draft.participants).toEqual([]);
    expect(draft.seed.length).toBeGreaterThan(0);

    const listed = await service.listTournaments();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(draft.id);
  });

  it('registers, edits, bulk-adds, and removes participants with sequential numbering', async () => {
    const draft = await service.createDraft('Torneo Sábado');

    await service.addParticipant(draft.id, 'Enrique');
    await service.addParticipant(draft.id, 'María');
    await expect(service.addParticipant(draft.id, '  enrique  ')).rejects.toThrow(/duplicado/i);

    const afterBulk = await service.addParticipantsBulk(
      draft.id,
      'Carlos\n\nAna\n  Luis  \nCarlos'
    );
    expect(afterBulk.participants.map((p) => [p.number, p.displayName])).toEqual([
      [1, 'Enrique'],
      [2, 'María'],
      [3, 'Carlos'],
      [4, 'Ana'],
      [5, 'Luis']
    ]);

    const afterRename = await service.updateParticipantName(
      draft.id,
      afterBulk.participants[1]!.id,
      'María José'
    );
    expect(afterRename.participants[1]!.displayName).toBe('María José');

    const afterRemove = await service.removeParticipant(
      draft.id,
      afterRename.participants[2]!.id // removes Carlos (#3)
    );
    expect(afterRemove.participants.map((p) => [p.number, p.displayName])).toEqual([
      [1, 'Enrique'],
      [2, 'María José'],
      [3, 'Ana'],
      [4, 'Luis']
    ]);
  });

  it('previews automatically using qualifying_elimination for non-multiples of 4 (e.g. 15) and blocks rounds_all_play', async () => {
    const draft = await service.createDraft('Torneo 15 Vecinos');
    const names = Array.from({ length: 15 }, (_, i) => `Vecino ${i + 1}`).join('\n');
    await service.addParticipantsBulk(draft.id, names);

    const preview = await service.previewTournament(draft.id);
    expect(preview.format).toBe('qualifying_elimination');
    expect(preview.participantCount).toBe(15);
    expect(preview.tablesPerRound).toBe(3);
    expect(preview.byesPerRound).toBe(3);
    expect(preview.availableFormats.find((f) => f.format === 'rounds_all_play')!.available).toBe(
      false
    );
    expect(preview.eliminationStages).toHaveLength(4); // Clasif 1, Clasif 2, Semi 8, Final 4

    await expect(
      service.updateConfig(draft.id, { format: 'rounds_all_play' }).then(() =>
        service.previewTournament(draft.id, { strictRequestedFormat: true })
      )
    ).rejects.toThrow(/múltiplos de 4/i);
  });

  it('allows rounds_all_play for multiples of 4 (e.g. 16), regenerates draw seed, and freezes snapshot on start', async () => {
    const draft = await service.createDraft('Torneo 16 Club');
    const names = Array.from({ length: 16 }, (_, i) => `Jugador ${i + 1}`).join('\n');
    await service.addParticipantsBulk(draft.id, names);
    await service.updateConfig(draft.id, {
      format: 'rounds_all_play',
      targetScore: 120,
      roundDurationSeconds: 1800
    });

    const preview1 = await service.previewTournament(draft.id);
    expect(preview1.format).toBe('rounds_all_play');
    expect(preview1.tablesPerRound).toBe(4);
    expect(preview1.byesPerRound).toBe(0);
    expect(preview1.selectedRounds).toBe(5);

    const updatedSeedRecord = await service.regenerateSeed(draft.id);
    expect(updatedSeedRecord.seed).not.toBe(draft.seed);

    const started = await service.confirmAndStartTournament(draft.id);
    expect(started.status).toBe('in_progress');
    expect(started.startedAt).toBe('2026-11-27T12:00:00.000Z');
    expect(started.ruleSnapshot).not.toBeNull();
    expect(started.ruleSnapshot!.parameters.targetScore).toBe(120);
    expect(started.ruleSnapshot!.parameters.participantCount).toBe(16);
    expect(started.rounds).toHaveLength(1);
    expect(started.rounds[0]!.roundNumber).toBe(1);
    expect(started.rounds[0]!.status).toBe('pending');
    expect(started.rounds[0]!.matches).toHaveLength(4);

    // Immutability after start
    await expect(service.addParticipant(draft.id, 'Tardío')).rejects.toThrow(/iniciado/i);
    await expect(service.regenerateSeed(draft.id)).rejects.toThrow(/iniciado/i);
    await expect(service.confirmAndStartTournament(draft.id)).rejects.toThrow(/iniciado/i);
    await expect(service.deleteDraft(draft.id)).rejects.toThrow(/borrador/i);
  });

  it('rejects previewing or starting with fewer than 4 participants', async () => {
    const draft = await service.createDraft('Muy Pequeño');
    await service.addParticipantsBulk(draft.id, 'Uno\nDos\nTres');

    await expect(service.previewTournament(draft.id)).rejects.toThrow(/4 participantes/i);
    await expect(service.confirmAndStartTournament(draft.id)).rejects.toThrow(/4 participantes/i);
  });

  it('deletes draft tournaments cleanly', async () => {
    const draft = await service.createDraft('Borrador Temporal');
    await service.deleteDraft(draft.id);
    expect(await service.listTournaments()).toHaveLength(0);
    expect(await service.getTournament(draft.id)).toBeNull();
  });
});
