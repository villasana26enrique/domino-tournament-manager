import { useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Download,
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
        .filter((m) => m.status === 'completed' && m.pairAScore !== null && m.pairBScore !== null && m.outcome !== null)
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
          Volver al inicio
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadFinalReportPdf(tournament, standings, stats)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar reporte PDF
          </button>

          {tournament.ruleSnapshot && (
            <button
              type="button"
              onClick={() =>
                downloadRulesPdf(
                  tournament.name,
                  tournament.ruleSnapshot!,
                  tournament.seed
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar reglamento PDF
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Champion Celebration Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 p-6 text-white shadow-lg sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">
          <Trophy className="h-3.5 w-3.5" />
          Torneo finalizado · {tournament.name}
        </span>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {topChampion && (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-xs font-bold tracking-wide text-amber-300 uppercase">
                Campeón Individual
              </p>
              <p className="mt-2 text-2xl font-extrabold sm:text-3xl">{topChampion.displayName}</p>
              <p className="mt-1 text-sm text-emerald-100">
                #{topChampion.participantNumber} · {topChampion.wins}V - {topChampion.draws}E -{' '}
                {topChampion.losses}D · Diferencia{' '}
                {topChampion.pointDiff >= 0 ? `+${topChampion.pointDiff}` : topChampion.pointDiff}{' '}
                pts
              </p>
            </div>
          )}

          {finalChampion && (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-xs font-bold tracking-wide text-emerald-200 uppercase">
                Pareja Ganadora de la Final ({finalChampion.finalMatch.pairAScore} -{' '}
                {finalChampion.finalMatch.pairBScore})
              </p>
              <p className="mt-2 text-xl font-bold">
                {finalChampion.winningPair[0].displayName} &amp;{' '}
                {finalChampion.winningPair[1].displayName}
              </p>
              <p className="mt-1 text-xs text-emerald-100/85">
                Gran Final disputada a 1 sola partida decisiva entre los 4 finalistas.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Tournament Statistics */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <BarChart3 className="h-4 w-4 text-emerald-700" />
          Estadísticas del torneo
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Partidas jugadas</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{stats.totalMatches}</p>
            <p className="text-xs text-stone-500">
              {stats.drawsCount} {stats.drawsCount === 1 ? 'empate por tiempo' : 'empates por tiempo'}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Puntos totales anotados</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{stats.totalPointsScored}</p>
            <p className="text-xs text-stone-500">
              {stats.repeatedPartnersCount === 0
                ? '0 compañeros repetidos'
                : `${stats.repeatedPartnersCount} repeticiones de compañero`}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Mayor puntaje en mesa</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">
              {stats.highestMatchScore ? `${stats.highestMatchScore.score} pts` : 'N/D'}
            </p>
            <p className="text-xs text-stone-500">
              {stats.highestMatchScore
                ? `R${stats.highestMatchScore.roundNumber} Mesa ${stats.highestMatchScore.tableNumber} (${stats.highestMatchScore.score}-${stats.highestMatchScore.loserScore})`
                : 'Sin datos'}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-stone-500">Mayor margen de victoria</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">
              {stats.largestVictoryMargin ? `+${stats.largestVictoryMargin.margin}` : 'N/D'}
            </p>
            <p className="text-xs text-stone-500">
              {stats.largestVictoryMargin
                ? `R${stats.largestVictoryMargin.roundNumber} Mesa ${stats.largestVictoryMargin.tableNumber} (${stats.largestVictoryMargin.winnerScore}-${stats.largestVictoryMargin.loserScore})`
                : 'Sin datos'}
            </p>
          </div>
        </div>
      </section>

      {/* Final Standings */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Award className="h-4 w-4 text-emerald-700" />
          Clasificación definitiva
        </h2>
        <StandingsTable rows={standings} highlightTopCount={finalChampion ? 2 : 3} />
      </section>

      {/* Rounds History */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Users className="h-4 w-4 text-emerald-700" />
          Resumen de rondas y mesas
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {tournament.rounds.map((round) => (
            <article
              key={round.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
            >
              <h3 className="text-sm font-bold text-stone-900">{round.stageName}</h3>
              <ul className="mt-2.5 space-y-2 text-xs">
                {round.matches.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"
                  >
                    <span className="truncate text-stone-700">
                      <strong>M{m.tableNumber}:</strong> {nameOf(m.pairA[0])} &amp;{' '}
                      {nameOf(m.pairA[1])} vs {nameOf(m.pairB[0])} &amp; {nameOf(m.pairB[1])}
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
            Correcciones administrativas registradas
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
            {tournament.resultAuditLogs
              .filter((l) => l.action === 'corrected')
              .map((log) => (
                <li key={log.id}>
                  Ronda {log.roundNumber}, Mesa {log.tableNumber}: {log.prevPairAScore}-
                  {log.prevPairBScore} → {log.newPairAScore}-{log.newPairBScore} ({log.reason})
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
