import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Clock,
  Pause,
  Play,
  SkipForward,
  Volume2
} from 'lucide-react';
import { computeTimerSnapshot, type RoundTimerState } from '../../core/index.js';
import type { PersistedRound } from '../../application/ports/tournament-repository.js';
import { playExpiredAlarm, playWarningChime } from '../../infrastructure/audio-alerts.js';

interface RoundTimerPanelProps {
  round: PersistedRound;
  warningBeforeEndSeconds: number;
  busy: boolean;
  onStartOrResume: () => Promise<void>;
  onPause: () => Promise<void>;
  onExpireNow: () => Promise<void>;
  onSyncTimer: () => Promise<{ warningTriggered: boolean; expiredTriggered: boolean } | null>;
}

const ROUND_STATUS_LABELS: Record<PersistedRound['status'], string> = {
  pending: 'Lista para iniciar',
  in_progress: 'En juego',
  paused: 'Pausada',
  time_expired: 'Tiempo agotado — Terminar mano en curso',
  recording_results: 'Registrando resultados',
  completed: 'Ronda completada'
};

export function RoundTimerPanel({
  round,
  warningBeforeEndSeconds,
  busy,
  onStartOrResume,
  onPause,
  onExpireNow,
  onSyncTimer
}: RoundTimerPanelProps) {
  const [nowUtcMs, setNowUtcMs] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const [visualNotice, setVisualNotice] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const timerState: RoundTimerState = {
    durationSeconds: round.durationSeconds,
    warningBeforeEndSeconds,
    elapsedBeforeRunMs: round.elapsedBeforeRunMs,
    timerStartedAtUtcMs: round.timerStartedAtUtcMs,
    warningFiredAtUtcMs: round.warningFiredAtUtcMs,
    expiredFiredAtUtcMs: round.expiredFiredAtUtcMs
  };

  const snap = computeTimerSnapshot(timerState, nowUtcMs);

  useEffect(() => {
    setNowUtcMs(Date.now());
  }, [round.id, round.elapsedBeforeRunMs, round.timerStartedAtUtcMs, round.status]);

  useEffect(() => {
    if (round.timerStartedAtUtcMs === null) return;

    const interval = window.setInterval(() => {
      setNowUtcMs(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [round.timerStartedAtUtcMs]);

  useEffect(() => {
    if (!snap.shouldFireWarning && !snap.shouldFireExpired) return;
    if (syncingRef.current) return;

    syncingRef.current = true;
    void onSyncTimer()
      .then((res) => {
        if (!res) return;
        if (res.expiredTriggered) {
          if (!muted) playExpiredAlarm();
          setVisualNotice(
            '¡Tiempo agotado! Terminen únicamente la mano en curso y registren los puntos exactos.'
          );
        } else if (res.warningTriggered) {
          if (!muted) playWarningChime();
          const warnMins = Math.max(1, Math.round(warningBeforeEndSeconds / 60));
          setVisualNotice(`Aviso: quedan ${warnMins} minutos para finalizar la ronda.`);
        }
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [snap.shouldFireWarning, snap.shouldFireExpired, muted, onSyncTimer, warningBeforeEndSeconds]);

  const isRunning = snap.isRunning;
  const isExpired = snap.isExpired || round.status === 'time_expired';
  const isWarning = !isExpired && snap.isWarningZone;
  const isCompleted = round.status === 'completed';

  const cardTheme = isExpired
    ? 'border-rose-300 bg-rose-950 text-white'
    : isWarning
      ? 'border-amber-300 bg-amber-950 text-white'
      : 'border-emerald-900 bg-emerald-950 text-white';

  const barColor = isExpired
    ? 'bg-rose-400'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <section className={`rounded-3xl border p-6 shadow-md transition-colors ${cardTheme}`}>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Clock & Status */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {round.stageName}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isExpired
                  ? 'bg-rose-500/30 text-rose-100'
                  : isWarning
                    ? 'bg-amber-500/30 text-amber-100'
                    : isRunning
                      ? 'bg-emerald-500/30 text-emerald-100'
                      : 'bg-white/10 text-stone-200'
              }`}
            >
              {ROUND_STATUS_LABELS[round.status]}
            </span>
          </div>

          <div className="flex items-baseline gap-4">
            <p
              aria-label="Tiempo restante de la ronda"
              className="font-mono text-5xl font-extrabold tracking-tight tabular-nums sm:text-6xl"
            >
              {snap.formatted}
            </p>
            <p className="text-xs text-white/75">
              Duración: {Math.round(round.durationSeconds / 60)} min
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isCompleted && !isExpired && !isRunning && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setVisualNotice(null);
                void onStartOrResume();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-300 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {round.elapsedBeforeRunMs > 0 ? 'Reanudar' : 'Iniciar ronda'}
            </button>
          )}

          {!isCompleted && isRunning && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPause()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              <Pause className="h-4 w-4" />
              Pausar
            </button>
          )}

          {!isCompleted && !isExpired && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onExpireNow()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-xs font-semibold text-white/90 transition hover:bg-white/15 disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Finalizar tiempo
            </button>
          )}

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Activar sonido' : 'Silenciar alarma'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-xs font-medium text-white/85 transition hover:bg-white/15"
          >
            {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {muted ? 'Silenciado' : 'Alarma activa'}
          </button>

          <button
            type="button"
            onClick={() => playWarningChime()}
            aria-label="Probar sonido"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-xs font-medium text-white/85 transition hover:bg-white/15"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Probar
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.round(snap.progressRatio * 100)}%` }}
        />
      </div>

      {/* Alert Banners */}
      {(visualNotice || isExpired || isWarning || snap.clockMovedBackwards) && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-black/25 px-3.5 py-2.5 text-xs font-medium text-white">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            {snap.clockMovedBackwards
              ? 'Se detectó un ajuste en el reloj del sistema; el tiempo previo se conservó sin pérdida.'
              : isExpired
                ? 'Tiempo agotado: culminen la mano en curso y anoten los puntos reales (si empatan, queda registrado empate).'
                : visualNotice ?? 'Últimos minutos de la ronda en curso.'}
          </span>
        </div>
      )}
    </section>
  );
}
