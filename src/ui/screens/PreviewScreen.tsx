import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Coffee,
  Download,
  Play,
  RefreshCw,
  ScrollText,
  Shuffle,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import type {
  TournamentConfig,
  TournamentFormat,
  TournamentPlan
} from '../../core/index.js';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';
import { downloadRulesPdf } from '../../infrastructure/pdf-exporter.js';

interface PreviewScreenProps {
  tournament: TournamentRecord;
  plan: TournamentPlan;
  busy: boolean;
  onEditParticipants: () => void;
  onUpdateConfig: (patch: Partial<TournamentConfig>, overrideRounds?: number | null) => Promise<void>;
  onRegenerateSeed: () => Promise<void>;
  onConfirmAndStart: () => Promise<void>;
}

export function PreviewScreen({
  tournament,
  plan,
  busy,
  onEditParticipants,
  onUpdateConfig,
  onRegenerateSeed,
  onConfirmAndStart
}: PreviewScreenProps) {
  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const p = participantById.get(id);
    return p ? `#${p.number} ${p.displayName}` : id;
  };

  async function handleSelectFormat(format: TournamentFormat) {
    await onUpdateConfig({ format }, null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onEditParticipants}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Editar participantes
          </button>
          <h1 className="text-2xl font-bold text-stone-900">Previsualización del torneo</h1>
          <p className="text-sm text-stone-500">
            Revisa la modalidad, las mesas iniciales y el reglamento oficial antes de iniciar{' '}
            <span className="font-semibold text-stone-800">{tournament.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRegenerateSeed()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerar sorteo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirmAndStart()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            Confirmar e iniciar torneo
          </button>
        </div>
      </div>

      {/* Format Selector Cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
          Modalidad del torneo
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {plan.availableFormats.map((option) => {
            const selected = plan.format === option.format;
            return (
              <button
                key={option.format}
                type="button"
                disabled={!option.available || busy}
                onClick={() => void handleSelectFormat(option.format)}
                className={`flex flex-col items-start rounded-2xl border p-5 text-left transition ${
                  selected
                    ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-700/20'
                    : option.available
                      ? 'border-stone-200 bg-white hover:border-emerald-400'
                      : 'cursor-not-allowed border-stone-200 bg-stone-100/80 opacity-65'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-base font-bold text-stone-900">{option.title}</span>
                  {selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-800 px-2.5 py-0.5 text-xs font-semibold text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Seleccionada
                    </span>
                  ) : !option.available ? (
                    <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                      Requiere múltiplo de 4
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">{option.reason}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Summary Metrics + Quick Settings */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <Users className="h-3.5 w-3.5 text-emerald-700" />
            Mesas iniciales
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{plan.tablesPerRound}</p>
          <p className="text-xs text-stone-500">
            {plan.activePerRound} activos · {plan.byesPerRound}{' '}
            {plan.byesPerRound === 1 ? 'descanso' : 'descansos'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            Rondas totales
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{plan.selectedRounds}</p>
          <p className="text-xs text-stone-500">
            {plan.format === 'rounds_all_play'
              ? 'Todos juegan igual (0 descansos)'
              : 'Hasta Gran Final de 1 partida'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <Clock className="h-3.5 w-3.5 text-emerald-700" />
            Duración estimada
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            ~{plan.estimatedDurationMinutes} min
          </p>
          <p className="text-xs text-stone-500">
            {Math.round(plan.config.roundDurationSeconds / 60)} min por ronda
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <Target className="h-3.5 w-3.5 text-emerald-700" />
            Meta de partida
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{plan.config.targetScore} pts</p>
          <p className="text-xs text-stone-500">Puntos reales sin recorte</p>
        </div>
      </section>

      {/* Quick Config Controls */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Ajustes rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-stone-600">
            <span>Objetivo de puntos</span>
            <select
              value={plan.config.targetScore}
              onChange={(e) => void onUpdateConfig({ targetScore: Number(e.target.value) })}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              {[75, 100, 120, 150, 200].map((pts) => (
                <option key={pts} value={pts}>
                  {pts} puntos
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-medium text-stone-600">
            <span>Duración de ronda</span>
            <select
              value={plan.config.roundDurationSeconds}
              onChange={(e) =>
                void onUpdateConfig({ roundDurationSeconds: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              {[15, 20, 25, 30, 40].map((mins) => (
                <option key={mins} value={mins * 60}>
                  {mins} minutos
                </option>
              ))}
            </select>
          </label>

          {plan.format === 'rounds_all_play' && (
            <label className="space-y-1 text-xs font-medium text-stone-600">
              <span>Cantidad de rondas</span>
              <select
                value={plan.selectedRounds}
                onChange={(e) => void onUpdateConfig({}, Number(e.target.value))}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                {[3, 4, 5, 6, 7].map((r) => (
                  <option key={r} value={r}>
                    {r} rondas {r === plan.recommendedRounds ? '(Recomendado)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {plan.format === 'rounds_all_play' && (
            <label className="space-y-1 text-xs font-medium text-stone-600">
              <span>Generación de cruces</span>
              <select
                value={plan.config.schedulingMode}
                onChange={(e) =>
                  void onUpdateConfig({
                    schedulingMode: e.target.value as TournamentConfig['schedulingMode']
                  })
                }
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="hybrid_competitive">Híbrido competitivo (Recomendado)</option>
                <option value="fixed_schedule">Calendario fijo previo</option>
              </select>
            </label>
          )}
        </div>
      </section>

      {/* Elimination Stages Progression */}
      {plan.eliminationStages && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-stone-900">
            Fases eliminatorias programadas
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {plan.eliminationStages.map((stage, idx) => (
              <div key={stage.roundNumber} className="flex items-center gap-2">
                <div
                  className={`rounded-xl border px-3.5 py-2 text-xs ${
                    stage.phase === 'final'
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-stone-200 bg-stone-50 text-stone-800'
                  }`}
                >
                  <p className="font-bold">{stage.stageName}</p>
                  <p className="text-[11px] text-stone-500">
                    {stage.expectedParticipants} jug. · {stage.tablesCount}{' '}
                    {stage.tablesCount === 1 ? 'mesa' : 'mesas'}
                    {stage.byesCount > 0 ? ` · ${stage.byesCount} pase libre` : ' · 0 descansos'}
                  </p>
                </div>
                {idx < plan.eliminationStages!.length - 1 && (
                  <span className="text-stone-400">→</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {plan.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Round 1 Preview Tables + Rules */}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <Shuffle className="h-4 w-4 text-emerald-700" />
              Vista previa — {plan.firstRoundPreview.stageName ?? 'Ronda 1'}
            </h2>
            <span className="font-mono text-xs text-stone-400">Semilla: {plan.seed}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plan.firstRoundPreview.matches.map((m) => (
              <div
                key={m.tableNumber}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-900 px-2.5 py-0.5 text-xs font-bold text-white">
                    Mesa {m.tableNumber}
                  </span>
                  <span className="text-[11px] font-medium text-stone-400">2 vs 2</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl bg-emerald-50/80 p-2.5">
                    <p className="text-[10px] font-bold tracking-wide text-emerald-800 uppercase">
                      Pareja A
                    </p>
                    <p className="mt-0.5 font-medium text-stone-900">{nameOf(m.pairA[0])}</p>
                    <p className="font-medium text-stone-900">{nameOf(m.pairA[1])}</p>
                  </div>
                  <div className="text-center text-[10px] font-bold text-stone-400">VS</div>
                  <div className="rounded-xl bg-stone-100 p-2.5">
                    <p className="text-[10px] font-bold tracking-wide text-stone-600 uppercase">
                      Pareja B
                    </p>
                    <p className="mt-0.5 font-medium text-stone-900">{nameOf(m.pairB[0])}</p>
                    <p className="font-medium text-stone-900">{nameOf(m.pairB[1])}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {plan.firstRoundPreview.byes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Coffee className="h-4 w-4 text-amber-700" />
                {plan.format === 'qualifying_elimination'
                  ? 'Pase libre al azar en Clasificatoria 1 (avanzan directo a Ronda 2)'
                  : 'Descansan en Ronda 1'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.firstRoundPreview.byes.map((id) => (
                  <span
                    key={id}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-800"
                  >
                    {nameOf(id)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Auto-Generated Rules */}
        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
                <ScrollText className="h-4 w-4 text-emerald-700" />
                Reglamento oficial generado
              </h2>
              <button
                type="button"
                onClick={() =>
                  downloadRulesPdf(tournament.name, plan.rulesDocument, plan.seed)
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar reglamento PDF
              </button>
            </div>
            <p className="mt-2 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
              {plan.rulesDocument.summary}
            </p>
            <div className="mt-4 space-y-4">
              {plan.rulesDocument.sections.map((sec) => (
                <div key={sec.id} className="space-y-1.5">
                  <h3 className="text-xs font-bold text-stone-900">{sec.title}</h3>
                  <ul className="space-y-1 pl-4 text-xs leading-relaxed text-stone-600">
                    {sec.items.map((item) => (
                      <li key={item} className="list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
