import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  computeTournamentStats,
  createSampleParticipants,
  planTournament,
  type CompletedRound,
  type RecordedMatch
} from '../../src/core/index.js';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import {
  generateFinalReportPdfBytes,
  generateRulesPdfBytes
} from '../../src/infrastructure/pdf-exporter.js';
import { LOCALE_STORAGE_KEY, detectInitialLocale } from '../../src/i18n/locale.js';
import { localizeStageName } from '../../src/i18n/domain-labels.js';
import { en } from '../../src/i18n/en.js';
import { es } from '../../src/i18n/es.js';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
      expect(typeof v, `Key ${full} must be string or function`).not.toBe('undefined');
      if (typeof v === 'string') {
        expect(v.trim().length, `Key ${full} must be non-empty`).toBeGreaterThan(0);
      }
    }
  }
  return keys.sort();
}

describe('i18n Core, Locale Detection, Rules & PDFs (TDD)', () => {
  it('detectInitialLocale prefers saved preference, then browser Spanish, defaulting to English', () => {
    const makeStorage = (saved: string | null) => ({
      getItem: (key: string) => (key === LOCALE_STORAGE_KEY ? saved : null)
    });

    // Saved preference wins over navigator languages
    expect(detectInitialLocale({ storage: makeStorage('en'), languages: ['es-VE'] })).toBe('en');
    expect(detectInitialLocale({ storage: makeStorage('es'), languages: ['en-US'] })).toBe('es');

    // Auto-detection from navigator languages
    expect(detectInitialLocale({ storage: makeStorage(null), languages: ['es-VE', 'en-US'] })).toBe('es');
    expect(detectInitialLocale({ storage: makeStorage(null), languages: ['es-ES'] })).toBe('es');
    expect(detectInitialLocale({ storage: makeStorage(null), language: 'es' })).toBe('es');

    // English primary default for EN, unsupported, or empty
    expect(detectInitialLocale({ storage: makeStorage(null), languages: ['en-US'] })).toBe('en');
    expect(detectInitialLocale({ storage: makeStorage(null), languages: ['fr-FR'] })).toBe('en');
    expect(detectInitialLocale({ storage: makeStorage(null), languages: [] })).toBe('en');
    expect(detectInitialLocale({ storage: makeStorage(null) })).toBe('en');
  });

  it('maintains exact structural key parity between English and Spanish dictionaries', () => {
    const enKeys = collectKeys(en as unknown as Record<string, unknown>);
    const esKeys = collectKeys(es as unknown as Record<string, unknown>);
    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(80);
  });

  it('localizes stage names accurately in English and preserves Spanish', () => {
    expect(localizeStageName('Clasificatoria 1', 'en')).toBe('Qualifying Round 1');
    expect(localizeStageName('Clasificatoria 2 (Corte)', 'en')).toBe('Qualifying Round 2 (Cut)');
    expect(localizeStageName('Cuartos de Final', 'en')).toBe('Quarterfinals');
    expect(localizeStageName('Semifinal', 'en')).toBe('Semifinals');
    expect(localizeStageName('Gran Final', 'en')).toBe('Grand Final');
    expect(localizeStageName('Ronda 3', 'en')).toBe('Round 3');

    expect(localizeStageName('Gran Final', 'es')).toBe('Gran Final');
    expect(localizeStageName('Ronda 3', 'es')).toBe('Ronda 3');
  });

  it('generates Official Rules in English when locale="en" and preserves Spanish default', () => {
    const participants = createSampleParticipants(15);
    const enPlan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'qualifying_elimination' },
      seed: 'i18n-rules',
      locale: 'en'
    });
    const esPlan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'qualifying_elimination' },
      seed: 'i18n-rules'
    });

    const enRules = enPlan.rulesDocument;
    expect(enRules.renderedMarkdown).toContain('# Official Domino Tournament Rules');
    expect(enRules.modalityTitle).toContain('Rotating Pairs');
    expect(enRules.sections).toHaveLength(5);
    expect(enRules.sections[0]!.title).toContain('Format & Structure');

    const esRules = esPlan.rulesDocument;
    expect(esRules.renderedMarkdown).toContain('# Reglamento Oficial del Torneo de Dominó');
  });

  it('generates valid English PDF bytes for rules and final tournament report', async () => {
    const participants = createSampleParticipants(8);
    const plan = planTournament({
      participants,
      config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'qualifying_elimination' },
      seed: 'i18n-pdf',
      locale: 'en'
    });

    const rulesBytes = generateRulesPdfBytes('Spring Domino Cup', plan.rulesDocument, 'i18n-pdf', 'en');
    const rulesHeader = new TextDecoder().decode(rulesBytes.slice(0, 5));
    expect(rulesHeader).toBe('%PDF-');
    expect(rulesBytes.byteLength).toBeGreaterThan(1000);

    let seq = 1;
    const service = new TournamentService({
      repository: new InMemoryTournamentRepository(),
      generateId: (p) => `${p}-${seq++}`,
      nowIso: () => '2026-11-27T19:30:00.000Z',
      nowUtcMs: () => 1_700_000_000_000
    });
    const draft = await service.createDraft('Spring Domino Cup');
    await service.addParticipantsBulk(draft.id, 'A\nB\nC\nD\nE\nF\nG\nH');
    await service.updateConfig(draft.id, { format: 'qualifying_elimination' });
    let record = await service.confirmAndStartTournament(draft.id);
    while (record.status === 'in_progress') {
      await service.simulateCurrentRoundResults(record.id);
      record = await service.completeRoundAndAdvance(record.id);
    }

    const standings = service.computeStandingsForRecord(record);
    const completedRounds: CompletedRound[] = record.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      phase: r.phase,
      stageName: r.stageName,
      byes: r.byes,
      eliminatedParticipantIds: r.eliminatedParticipantIds,
      metrics: r.metrics,
      explanations: r.explanations,
      matches: r.matches.map(
        (m): RecordedMatch => ({
          matchId: m.id,
          roundNumber: r.roundNumber,
          tableNumber: m.tableNumber,
          pairA: m.pairA,
          pairB: m.pairB,
          status: 'completed',
          pairAScore: m.pairAScore ?? 100,
          pairBScore: m.pairBScore ?? 60,
          winnerPair: m.winnerPair,
          outcome: m.outcome ?? 'pair_a_win',
          endedBy: m.endedBy ?? 'target_score'
        })
      )
    }));
    const stats = computeTournamentStats(record.participants, completedRounds, standings);

    const reportBytes = generateFinalReportPdfBytes(record, standings, stats, 'en');
    const reportHeader = new TextDecoder().decode(reportBytes.slice(0, 5));
    expect(reportHeader).toBe('%PDF-');
    expect(reportBytes.byteLength).toBeGreaterThan(1000);
  });
});
