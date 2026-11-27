import { useEffect, useState } from 'react';
import { Coffee, GitBranch, LayoutGrid, Minimize2 } from 'lucide-react';
import { computeTimerSnapshot, type RoundTimerState, type StandingRow } from '../../core/index.js';
import type {
  PersistedRound,
  TournamentRecord
} from '../../application/ports/tournament-repository.js';
import { EliminationBracketView } from './EliminationBracketView.js';

interface ProjectionViewProps {
  tournamentName: string;
  round: PersistedRound;
  warningBeforeEndSeconds: number;
  nameOf: (participantId: string) => string;
  onExit: () => void;
  tournament?: TournamentRecord;
  standings?: StandingRow[];
}

export function ProjectionView({
  tournamentName,
  round,
  warningBeforeEndSeconds,
  nameOf,
  onExit,
  tournament,
  standings = []
}: ProjectionViewProps) {
  const [nowUtcMs, setNowUtcMs] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<'tables' | 'bracket'>('tables');
  const hasBracket =
    tournament !== undefined &&
    tournament.config.format === 'qualifying_elimination' &&
    tournament.eliminationStages !== null;

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [onExit]);

  useEffect(() => {
    if (round.timerStartedAtUtcMs === null) return;
    const id = window.setInterval(() => setNowUtcMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [round.timerStartedAtUtcMs]);

  const timerState: RoundTimerState = {
    durationSeconds: round.durationSeconds,
    warningBeforeEndSeconds,
    elapsedBeforeRunMs: round.elapsedBeforeRunMs,
    timerStartedAtUtcMs: round.timerStartedAtUtcMs,
    warningFiredAtUtcMs: round.warningFiredAtUtcMs,
    expiredFiredAtUtcMs: round.expiredFiredAtUtcMs
  };
  const snap = computeTimerSnapshot(timerState, nowUtcMs);
  const isExpired = snap.isExpired || round.status === 'time_expired';
  const isWarning = !isExpired && snap.isWarningZone;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
              {tournamentName}
            </p>
            <h2 className="text-xl font-bold sm:text-2xl">{round.stageName}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasBracket && (
              <div className="inline-flex rounded-xl border border-white/15 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('tables')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'tables'
                      ? 'bg-emerald-700 text-white'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Mesas y reloj
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('bracket')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'bracket'
                      ? 'bg-emerald-700 text-white'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Llave en vivo
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Minimize2 className="h-4 w-4" />
              Salir de proyección
            </button>
          </div>
        </div>

        {/* Giant High-Contrast Clock (compact when viewing bracket) */}
        <div
          className={`rounded-3xl border text-center ${
            viewMode === 'bracket' ? 'p-4 sm:p-5' : 'p-6 sm:p-10'
          } ${
            isExpired
              ? 'border-rose-400 bg-rose-950/90'
              : isWarning
                ? 'border-amber-400 bg-amber-950/90'
                : 'border-emerald-800 bg-emerald-950/80'
          }`}
        >
          <p
            className={`font-mono font-black tracking-tight tabular-nums ${
              viewMode === 'bracket' ? 'text-4xl sm:text-5xl' : 'text-7xl sm:text-9xl'
            }`}
          >
            {snap.formatted}
          </p>
          <p className="mt-2 text-xs font-semibold tracking-wide text-white/85 uppercase sm:text-sm">
            {isExpired
              ? 'Tiempo agotado — Terminar únicamente la mano en curso'
              : isWarning
                ? 'Últimos minutos de la ronda'
                : snap.isRunning
                  ? 'Ronda en juego'
                  : 'Cronómetro pausado / listo para iniciar'}
          </p>
          <div className="mx-auto mt-4 h-2.5 max-w-2xl overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full transition-all duration-300 ${
                isExpired ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.round(snap.progressRatio * 100)}%` }}
            />
          </div>
        </div>

        {viewMode === 'bracket' && tournament ? (
          <EliminationBracketView
            tournament={tournament}
            standings={standings}
            nameOf={nameOf}
            theme="dark"
          />
        ) : (
          <>
            {/* Active Tables Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {round.matches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-stone-800 bg-stone-900 p-4 shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-700 px-3 py-1 text-sm font-bold text-white">
                      Mesa {m.tableNumber}
                    </span>
                    <span className="text-sm font-bold text-amber-300">
                      {m.status === 'completed'
                        ? `${m.pairAScore} - ${m.pairBScore}`
                        : 'En juego'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="rounded-xl bg-stone-800/90 p-2.5">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Pareja A</p>
                      <p className="mt-1 truncate font-medium">{nameOf(m.pairA[0])}</p>
                      <p className="truncate font-medium">{nameOf(m.pairA[1])}</p>
                    </div>
                    <div className="rounded-xl bg-stone-800/90 p-2.5">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Pareja B</p>
                      <p className="mt-1 truncate font-medium">{nameOf(m.pairB[0])}</p>
                      <p className="truncate font-medium">{nameOf(m.pairB[1])}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {round.byes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/50 px-4 py-3 text-xs sm:text-sm">
                <Coffee className="h-4 w-4 text-amber-300" />
                <span className="font-bold text-amber-200">Descansan / Pase libre:</span>
                {round.byes.map((id) => (
                  <span key={id} className="rounded-lg bg-white/10 px-2.5 py-1 font-medium">
                    {nameOf(id)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
