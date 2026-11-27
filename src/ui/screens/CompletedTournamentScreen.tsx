import { useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Download,
  GitBranch,
  History,
  Printer,
  Trophy,
  Users
} from 'lucide-react';
import {
  computeTournamentStats,
  type CompletedRound,
  type RecordedMatch,
  type StandingRow
} from '../../core/index.js';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';
import {
  downloadFinalReportPdf,
  downloadRulesPdf
} from '../../infrastructure/pdf-exporter.js';
import { useI18n } from '../../i18n/context.js';
import { localizeRulesDocument, localizeStageName } from '../../i18n/domain-labels.js';
import { EliminationBracketView } from '../components/EliminationBracketView.js';
import { StandingsTable } from '../components/StandingsTable.js';

interface CompletedTournamentScreenProps {
  tournament: TournamentRecord;
  standings: StandingRow[];
  onBackHome: () => void;
}

export function CompletedTournamentScreen({
  tournament,
  standings,
  onBackHome
}: CompletedTournamentScreenProps) {
  const { locale, t } = useI18n();

  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const p = participantById.get(id);
    return p ? `#${p.number} ${p.displayName}` : id;
  };

  const stats = useMemo(() => {
    const completedRounds: CompletedRound[] = tournament.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      phase: r.phase,
      stageName: r.stageName,
      byes: r.byes,
      eliminatedParticipantIds: r.eliminatedParticipantIds,
      metrics: r.metrics,
      explanations: r.explanations,
      matches: r.matches
        .filter(
          (m) =>
            m.status === 'completed' &&
            m.pairAScore !== null &&
            m.pairBScore !== null &&
            m.outcome !== null
        )
        .map(
          (m): RecordedMatch => ({
            matchId: m.id,
            roundNumber: r.roundNumber,
            tableNumber: m.tableNumber,
            pairA: m.pairA,
            pairB: m.pairB,
            status: 'completed',
            pairAScore: m.pairAScore!,
            pairBScore: m.pairBScore!,
            winnerPair: m.winnerPair,
            outcome: m.outcome!,
            endedBy: m.endedBy ?? 'target_score'
          })
        )
    }));

    return computeTournamentStats(tournament.participants, completedRounds, standings);
  }, [standings, tournament.participants, tournament.rounds]);

  const localizedRules = tournament.ruleSnapshot
    ? localizeRulesDocument(
        tournament.ruleSnapshot,
        tournament.config,
        tournament.eliminationStages,
        locale
      )
    : null;

  const finalChampion = tournament.finalChampion;
  const topChampion = finalChampion?.individualChampion ?? standings[0];

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.completed.backHome}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadFinalReportPdf(tournament, standings, stats, locale)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" />
            {t.completed.downloadReportPdf}
          </button>

          {localizedRules && (
            <button
              type="button"
              onClick={() =>
                downloadRulesPdf(tournament.name, localizedRules, tournament.seed, locale)
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" />
              {t.completed.downloadRulesPdf}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            <Printer className="h-3.5 w-3.5" />
            {t.completed.print}
          </button>
        </div>
      </div>

      {/* Champion Celebration Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 p-6 text-white shadow-lg sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">
          <Trophy className="h-3.5 w-3.5" />
          {t.completed.finishedBanner(tournament.name)}
        </span>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {topChampion && (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-xs font-bold tracking-wide text-amber-300 uppercase">
                {t.completed.individualChampion}
              </p>
              <p className="mt-2 text-2xl font-extrabold sm:text-3xl">{topChampion.displayName}</p>
              <p className="mt-1 text-sm text-emerald-100">
                {t.completed.championRecord(
                  topChampion.participantNumber,
                  topChampion.wins,
                  topChampion.draws,
                  topChampion.losses,
                  topChampion.pointDiff >= 0
                    ? `+${topChampion.pointDiff}`
                    : String(topChampion.pointDiff)
                )}
              </p>
            </div>
          )}

          {finalChampion && (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-xs font-bold tracking-wide text-emerald-200 uppercase">
                {t.completed.winningPairTitle(
                  finalChampion.finalMatch.pairAScore,
                  finalChampion.finalMatch.pairBScore
                )}
              </p>
              <p className="mt-2 text-xl font-bold">
                {finalChampion.winningPair[0].displayName} &amp;{' '}
                {finalChampion.winningPair[1].displayName}
              </p>
              <p className="mt-1 text-xs text-emerald-100/85">
                {t.completed.winningPairSubtitle}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Tournament Statistics */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <BarChart3 className="h-4 w-4 text-emerald-700" />
          {t.completed.statsTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">{t.completed.matchesPlayed}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{stats.totalMatches}</p>
            <p className="text-xs text-stone-500">
              {t.completed.timeDrawsCount(stats.drawsCount)}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">{t.completed.totalPoints}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{stats.totalPointsScored}</p>
            <p className="text-xs text-stone-500">
              {stats.repeatedPartnersCount === 0
                ? t.completed.noRepeatPartners
                : t.completed.repeatPartners(stats.repeatedPartnersCount)}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">{t.completed.highestScore}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">
              {stats.highestMatchScore ? `${stats.highestMatchScore.score} pts` : t.completed.noData}
            </p>
            <p className="text-xs text-stone-500">
              {stats.highestMatchScore
                ? t.completed.highestScoreDetail(
                    stats.highestMatchScore.score,
                    stats.highestMatchScore.roundNumber,
                    stats.highestMatchScore.tableNumber,
                    stats.highestMatchScore.loserScore
                  )
                : t.completed.noData}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">{t.completed.largestMargin}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">
              {stats.largestVictoryMargin
                ? `+${stats.largestVictoryMargin.margin}`
                : t.completed.noData}
            </p>
            <p className="text-xs text-stone-500">
              {stats.largestVictoryMargin
                ? t.completed.largestMarginDetail(
                    stats.largestVictoryMargin.roundNumber,
                    stats.largestVictoryMargin.tableNumber,
                    stats.largestVictoryMargin.winnerScore,
                    stats.largestVictoryMargin.loserScore
                  )
                : t.completed.noData}
            </p>
          </div>
        </div>
      </section>

      {/* Visual Elimination Bracket (qualifying_elimination only) */}
      {tournament.config.format === 'qualifying_elimination' &&
        tournament.eliminationStages !== null && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <GitBranch className="h-4 w-4 text-emerald-700" />
              {t.completed.bracketSectionTitle}
            </h2>
            <EliminationBracketView
              tournament={tournament}
              standings={standings}
              nameOf={nameOf}
              theme="light"
            />
          </section>
        )}

      {/* Final Standings */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Award className="h-4 w-4 text-emerald-700" />
          {t.completed.finalStandings}
        </h2>
        <StandingsTable rows={standings} highlightTopCount={finalChampion ? 2 : 3} />
      </section>

      {/* Rounds History */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Users className="h-4 w-4 text-emerald-700" />
          {t.completed.roundsSummary}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {tournament.rounds.map((round) => (
            <article
              key={round.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
            >
              <h3 className="text-sm font-bold text-stone-900">
                {localizeStageName(round.stageName, locale)}
              </h3>
              <ul className="mt-2.5 space-y-2 text-xs">
                {round.matches.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"
                  >
                    <span className="truncate text-stone-700">
                      <strong>{t.completed.tableShort(m.tableNumber)}</strong> {nameOf(m.pairA[0])}{' '}
                      &amp; {nameOf(m.pairA[1])} vs {nameOf(m.pairB[0])} &amp; {nameOf(m.pairB[1])}
                    </span>
                    <span className="shrink-0 font-mono font-bold text-stone-900">
                      {m.pairAScore}-{m.pairBScore}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {tournament.resultAuditLogs.some((l) => l.action === 'corrected') && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <History className="h-4 w-4 text-amber-600" />
            {t.completed.correctionsTitle}
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
            {tournament.resultAuditLogs
              .filter((l) => l.action === 'corrected')
              .map((log) => (
                <li key={log.id}>
                  {t.completed.correctionItem(
                    log.roundNumber,
                    log.tableNumber,
                    log.prevPairAScore ?? 0,
                    log.prevPairBScore ?? 0,
                    log.newPairAScore,
                    log.newPairBScore,
                    log.reason ?? ''
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
