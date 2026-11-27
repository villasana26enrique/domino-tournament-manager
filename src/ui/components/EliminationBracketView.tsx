import { ArrowRight, CheckCircle2, Crown, GitBranch, Trophy } from 'lucide-react';
import type { StandingRow } from '../../core/index.js';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';

interface EliminationBracketViewProps {
  tournament: TournamentRecord;
  standings: StandingRow[];
  nameOf: (participantId: string) => string;
  theme?: 'light' | 'dark';
}

export function EliminationBracketView({
  tournament,
  standings,
  nameOf,
  theme = 'light'
}: EliminationBracketViewProps) {
  const stages = tournament.eliminationStages;
  if (tournament.config.format !== 'qualifying_elimination' || !stages || stages.length < 3) {
    return null;
  }

  const isDark = theme === 'dark';
  const knockoutStages = stages.slice(2);
  const firstKnockout = knockoutStages[0]!;
  const cutCount = firstKnockout.expectedParticipants;
  const knockoutStarted = tournament.rounds.some((r) => r.roundNumber >= 3);

  const qualifiers = standings.slice(0, cutCount);
  const belowCut = standings.slice(cutCount);

  const cardSurface = isDark
    ? 'border-stone-800 bg-stone-900 text-stone-100'
    : 'border-stone-200 bg-white text-stone-900 shadow-xs';
  const mutedText = isDark ? 'text-stone-400' : 'text-stone-500';
  const placeholderSurface = isDark
    ? 'border-stone-700 bg-stone-900/50 text-stone-400'
    : 'border-stone-300 bg-stone-50 text-stone-500';

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${
          isDark
            ? 'border-emerald-800/70 bg-emerald-950/60 text-emerald-100'
            : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-bold sm:text-sm">
          <GitBranch className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Ruta a la Final</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium opacity-90">
          <span>Clasificatoria (R1–R2)</span>
          {knockoutStages.map((s) => (
            <span key={s.roundNumber} className="inline-flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3 opacity-60" />
              <span>
                {s.stageName} ({s.expectedParticipants})
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Horizontal Bracket Columns */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-4">
          {/* Column 1: Qualifying Stage + Cut Line */}
          <section
            aria-label="Clasificatoria y corte"
            className={`flex w-72 shrink-0 flex-col rounded-2xl border p-4 ${cardSurface}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">Clasificatoria (R1–R2)</h3>
                <p className={`text-[11px] ${mutedText}`}>
                  Corte exacto a {cutCount} jugadores
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  knockoutStarted
                    ? isDark
                      ? 'bg-emerald-900 text-emerald-200'
                      : 'bg-emerald-100 text-emerald-800'
                    : isDark
                      ? 'bg-amber-900/70 text-amber-200'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {knockoutStarted ? 'Corte definido' : 'En juego'}
              </span>
            </div>

            <div className="space-y-1.5">
              <p
                className={`text-[11px] font-bold uppercase ${
                  isDark ? 'text-emerald-300' : 'text-emerald-800'
                }`}
              >
                {knockoutStarted
                  ? `Clasificados a ${firstKnockout.stageName} (${qualifiers.length})`
                  : `Zona de clasificación (Top ${cutCount})`}
              </p>

              {qualifiers.map((row, idx) => (
                <div
                  key={row.participantId}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                    isDark
                      ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-100'
                      : 'border-emerald-200 bg-emerald-50/80 text-stone-900'
                  }`}
                >
                  <span className="truncate font-medium">
                    <span className="mr-1.5 font-mono text-[11px] font-bold text-emerald-600">
                      #{idx + 1}
                    </span>
                    {row.displayName}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] font-semibold">
                    {row.wins}V-{row.losses}D ({row.pointDiff >= 0 ? `+${row.pointDiff}` : row.pointDiff})
                  </span>
                </div>
              ))}
            </div>

            {belowCut.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-dashed border-stone-400/40 pt-3">
                <p className={`text-[10px] font-bold uppercase ${mutedText}`}>
                  {knockoutStarted ? 'Eliminados en corte' : 'Por debajo del corte'}
                </p>
                {belowCut.map((row, idx) => (
                  <div
                    key={row.participantId}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] ${
                      isDark ? 'bg-stone-800/70 text-stone-400' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <span className="truncate">
                      #{cutCount + idx + 1} {row.displayName}
                    </span>
                    <span className="shrink-0 font-mono">
                      {row.wins}V-{row.losses}D
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Knockout Columns: Cuartos -> Semifinal -> Gran Final */}
          {knockoutStages.map((stage) => {
            const persistedRound = tournament.rounds.find(
              (r) => r.roundNumber === stage.roundNumber
            );
            const isFinal = stage.phase === 'final';

            return (
              <section
                key={stage.roundNumber}
                aria-label={stage.stageName}
                className={`flex w-72 shrink-0 flex-col rounded-2xl border p-4 ${cardSurface}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold">{stage.stageName}</h3>
                    <p className={`text-[11px] ${mutedText}`}>
                      {stage.expectedParticipants} jugadores · {stage.tablesCount}{' '}
                      {stage.tablesCount === 1 ? 'mesa' : 'mesas'}
                    </p>
                  </div>
                  {persistedRound ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        persistedRound.status === 'completed'
                          ? isDark
                            ? 'bg-emerald-900 text-emerald-200'
                            : 'bg-emerald-100 text-emerald-800'
                          : isDark
                            ? 'bg-amber-900/70 text-amber-200'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {persistedRound.status === 'completed' ? 'Definida' : 'En juego'}
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        isDark ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-center gap-3">
                  {persistedRound ? (
                    persistedRound.matches.map((match) => {
                      const pairAWon = match.winnerPair === 'A';
                      const pairBWon = match.winnerPair === 'B';
                      const winLabel = isFinal ? 'Campeones' : 'Avanza';

                      return (
                        <article
                          key={match.id}
                          className={`rounded-xl border p-3 ${
                            isDark
                              ? 'border-stone-700 bg-stone-800/80'
                              : 'border-stone-200 bg-stone-50/70'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between text-[11px]">
                            <span className="font-bold">Mesa {match.tableNumber}</span>
                            <span className={`font-mono font-bold ${mutedText}`}>
                              {match.status === 'completed'
                                ? `${match.pairAScore} - ${match.pairBScore}`
                                : 'Por jugar'}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div
                              className={`rounded-lg border px-2.5 py-1.5 ${
                                pairAWon
                                  ? isDark
                                    ? 'border-emerald-500/70 bg-emerald-950/80 text-emerald-100'
                                    : 'border-emerald-300 bg-emerald-100/80 text-emerald-950'
                                  : isDark
                                    ? 'border-stone-700 bg-stone-900/60'
                                    : 'border-stone-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                                <span>Pareja A</span>
                                {pairAWon && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {winLabel}
                                  </span>
                                )}
                              </div>
                              <p className="truncate font-medium">{nameOf(match.pairA[0])}</p>
                              <p className="truncate font-medium">{nameOf(match.pairA[1])}</p>
                            </div>

                            <div
                              className={`rounded-lg border px-2.5 py-1.5 ${
                                pairBWon
                                  ? isDark
                                    ? 'border-emerald-500/70 bg-emerald-950/80 text-emerald-100'
                                    : 'border-emerald-300 bg-emerald-100/80 text-emerald-950'
                                  : isDark
                                    ? 'border-stone-700 bg-stone-900/60'
                                    : 'border-stone-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                                <span>Pareja B</span>
                                {pairBWon && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {winLabel}
                                  </span>
                                )}
                              </div>
                              <p className="truncate font-medium">{nameOf(match.pairB[0])}</p>
                              <p className="truncate font-medium">{nameOf(match.pairB[1])}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    Array.from({ length: stage.tablesCount }, (_, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border border-dashed p-3.5 text-xs ${placeholderSurface}`}
                      >
                        <p className="font-bold">Mesa {idx + 1} · Por definir</p>
                        <p className="mt-1 text-[11px] opacity-85">
                          Esperando clasificados de la fase anterior.
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}

          {/* Final Column: Champion Card */}
          <section
            aria-label="Campeón del torneo"
            className={`flex w-64 shrink-0 flex-col justify-center rounded-2xl border p-4 ${
              tournament.finalChampion
                ? isDark
                  ? 'border-amber-500/60 bg-gradient-to-br from-amber-950/70 to-emerald-950/70 text-white'
                  : 'border-amber-300 bg-gradient-to-br from-amber-50 to-emerald-50 text-stone-900 shadow-xs'
                : placeholderSurface
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <Trophy
                className={`h-4 w-4 ${
                  tournament.finalChampion ? 'text-amber-500' : 'opacity-60'
                }`}
              />
              <span>Campeón</span>
            </div>

            {tournament.finalChampion ? (
              <div className="mt-3 space-y-3">
                <div
                  className={`rounded-xl border p-3 ${
                    isDark
                      ? 'border-amber-400/40 bg-stone-900/70'
                      : 'border-amber-200 bg-white'
                  }`}
                >
                  <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase">
                    <Crown className="h-3.5 w-3.5" />
                    Campeón Individual
                  </p>
                  <p className="mt-1 text-base font-extrabold">
                    {tournament.finalChampion.individualChampion.displayName}
                  </p>
                  <p className={`text-[11px] ${mutedText}`}>
                    {tournament.finalChampion.individualChampion.wins}V -{' '}
                    {tournament.finalChampion.individualChampion.losses}D · Dif{' '}
                    {tournament.finalChampion.individualChampion.pointDiff >= 0
                      ? `+${tournament.finalChampion.individualChampion.pointDiff}`
                      : tournament.finalChampion.individualChampion.pointDiff}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3 text-xs ${
                    isDark
                      ? 'border-emerald-600/40 bg-stone-900/60'
                      : 'border-emerald-200 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">
                    Pareja Ganadora Final
                  </p>
                  <p className="mt-1 font-semibold">
                    {tournament.finalChampion.winningPair[0].displayName} &amp;{' '}
                    {tournament.finalChampion.winningPair[1].displayName}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs">
                <p className="font-bold">Por definir</p>
                <p className="mt-1 text-[11px] opacity-85">
                  Se proclama al cierre de la Gran Final.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
