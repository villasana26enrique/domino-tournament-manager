import { describe, expect, it } from 'vitest';
import {
  calculateStandings,
  computeTournamentStats,
  createSampleParticipants,
  DEFAULT_TOURNAMENT_CONFIG,
  planTournament,
  type CompletedRound
} from '../../src/core/index.js';
import type { TournamentRecord } from '../../src/application/ports/tournament-repository.js';
import {
  CLUB_BRANDING_STORAGE_KEY,
  createClubBrandingStore,
  MAX_LOGO_DATA_URL_LENGTH
} from '../../src/infrastructure/club-branding-store.js';
import {
  generateFinalReportPdfBytes,
  generateRulesPdfBytes
} from '../../src/infrastructure/pdf-exporter.js';
import { buildChampionCardSvg } from '../../src/infrastructure/share-card-exporter.js';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function buildSampleCompletedTournament(): {
  record: TournamentRecord;
  standings: ReturnType<typeof calculateStandings>;
  stats: ReturnType<typeof computeTournamentStats>;
} {
  const participants = createSampleParticipants(8);
  const plan = planTournament({
    participants,
    config: { ...DEFAULT_TOURNAMENT_CONFIG, format: 'rounds_all_play' },
    seed: 'share-seed',
    overrideRounds: 1
  });
  const completedRounds: CompletedRound[] = [
    {
      roundNumber: 1,
      phase: 'regular',
      stageName: 'Ronda 1',
      byes: [],
      metrics: plan.firstRoundPreview.metrics,
      explanations: plan.firstRoundPreview.explanations,
      matches: plan.firstRoundPreview.matches.map((m, idx) => ({
        ...m,
        matchId: `m-${idx + 1}`,
        roundNumber: 1,
        status: 'completed',
        pairAScore: 108,
        pairBScore: 64,
        winnerPair: 'A',
        outcome: 'pair_a_win',
        endedBy: 'target_score'
      }))
    }
  ];
  const standings = calculateStandings({
    participants,
    completedRounds,
    rankingMode: plan.rankingMode
  });
  const stats = computeTournamentStats(participants, completedRounds, standings);

  const record: TournamentRecord = {
    id: 'trn-share',
    name: 'Copa Amigos & Co <2026>',
    status: 'completed',
    seed: plan.seed,
    config: plan.config,
    overrideRounds: 1,
    plannedRounds: 1,
    currentRoundNumber: 1,
    participants,
    plannedByesByRound: plan.plannedByesByRound,
    eliminationStages: null,
    ruleSnapshot: plan.rulesDocument,
    rounds: [],
    resultAuditLogs: [],
    finalChampion: {
      individualChampion: standings[0]!,
      winningPair: [standings[0]!, standings[1]!],
      decidedByTieBreak: false,
      finalMatch: {
        matchId: 'm-1',
        roundNumber: 1,
        tableNumber: 1,
        pairA: [participants[0]!.id, participants[1]!.id],
        pairB: [participants[2]!.id, participants[3]!.id],
        status: 'completed',
        pairAScore: 108,
        pairBScore: 64,
        winnerPair: 'A',
        outcome: 'pair_a_win',
        endedBy: 'target_score'
      }
    },
    createdAt: '2026-11-27T12:00:00.000Z',
    startedAt: '2026-11-27T12:30:00.000Z',
    completedAt: '2026-11-27T13:00:00.000Z',
    updatedAt: '2026-11-27T13:00:00.000Z'
  };
  return { record, standings, stats };
}

describe('Club Branding, PDF Free/Pro Watermark & Share Card SVG (TDD)', () => {
  it('saves, trims, validates, and clears club branding in local storage', () => {
    const storage = new MemoryStorage();
    const store = createClubBrandingStore(storage);

    expect(store.load()).toEqual({ clubName: '', logoDataUrl: null });

    const saved = store.save({
      clubName: '  Club Dominó Caracas '.padEnd(80, 'X'),
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgo='
    });
    expect(saved.clubName.length).toBe(60);
    expect(storage.getItem(CLUB_BRANDING_STORAGE_KEY)).not.toBeNull();
    expect(store.load().clubName).toBe(saved.clubName);

    expect(() =>
      store.save({ clubName: 'Ok', logoDataUrl: 'https://evil.example/logo.png' })
    ).toThrow(/Invalid logo/i);

    expect(() =>
      store.save({
        clubName: 'Ok',
        logoDataUrl: `data:image/png;base64,${'A'.repeat(MAX_LOGO_DATA_URL_LENGTH + 10)}`
      })
    ).toThrow(/Logo exceeds/i);

    store.clear();
    expect(store.load()).toEqual({ clubName: '', logoDataUrl: null });
  });

  it('builds XML-escaped WhatsApp Champion Card SVG with Pro club branding and stats', () => {
    const { record, standings, stats } = buildSampleCompletedTournament();
    const svg = buildChampionCardSvg({
      tournament: record,
      standings,
      stats,
      locale: 'en',
      clubBranding: { clubName: 'Club <Pro> & Amigos', logoDataUrl: null }
    });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Club &lt;Pro&gt; &amp; Amigos');
    expect(svg).toContain('Copa Amigos &amp; Co &lt;2026&gt;');
    expect(svg).toContain(standings[0]!.displayName);
    expect(svg).toContain('108 - 64');
  });

  it('adds Free footer on Free PDFs and omits Free footer + includes Club Name on Pro PDFs', () => {
    const { record, standings, stats } = buildSampleCompletedTournament();
    const plan = planTournament({
      participants: createSampleParticipants(8),
      config: DEFAULT_TOURNAMENT_CONFIG,
      seed: 'pdf-brand'
    });

    const freeRulesPdf = new TextDecoder('latin1').decode(
      generateRulesPdfBytes('Copa Vecinos', plan.rulesDocument, plan.seed, 'es', { isPro: false })
    );
    const proRulesPdf = new TextDecoder('latin1').decode(
      generateRulesPdfBytes('Copa Vecinos', plan.rulesDocument, plan.seed, 'es', {
        isPro: true,
        clubBranding: { clubName: 'Club Venezuela Pro', logoDataUrl: null }
      })
    );
    expect(freeRulesPdf).toContain('Free Edition');
    expect(proRulesPdf).not.toContain('Free Edition');
    expect(proRulesPdf).toContain('Club Venezuela Pro');

    const freeReportPdf = new TextDecoder('latin1').decode(
      generateFinalReportPdfBytes(record, standings, stats, 'en', { isPro: false })
    );
    const proReportPdf = new TextDecoder('latin1').decode(
      generateFinalReportPdfBytes(record, standings, stats, 'en', {
        isPro: true,
        clubBranding: { clubName: 'Club Venezuela Pro', logoDataUrl: null }
      })
    );
    expect(freeReportPdf).toContain('Free Edition');
    expect(proReportPdf).not.toContain('Free Edition');
    expect(proReportPdf).toContain('Club Venezuela Pro');
  });
});
