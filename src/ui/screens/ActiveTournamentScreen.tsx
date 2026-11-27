import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Coffee,
  Download,
  Edit3,
  FlaskConical,
  History,
  Lock,
  Maximize2,
  ScrollText,
  ShieldCheck,
  Table2,
  UserMinus,
  UserPlus,
  Users
} from 'lucide-react';
import type { MatchEndReason, StandingRow } from '../../core/index.js';
import type {
  PersistedMatch,
  TournamentRecord
} from '../../application/ports/tournament-repository.js';
import type { SyncTimerOutcome } from '../../application/tournament-service.js';
import { downloadRulesPdf } from '../../infrastructure/pdf-exporter.js';
import { setKeepAwake } from '../../infrastructure/power-manager.js';
import { MatchResultModal } from '../components/MatchResultModal.js';
import { ProjectionView } from '../components/ProjectionView.js';
import { RoundTimerPanel } from '../components/RoundTimerPanel.js';
import { StandingsTable } from '../components/StandingsTable.js';

type TabId = 'tables' | 'standings' | 'participants' | 'rules_audit';

interface ActiveTournamentScreenProps {
  tournament: TournamentRecord;
  standings: StandingRow[];
  busy: boolean;
  onRequestLeave: () => void;
  onStartRoundTimer: () => Promise<void>;
  onPauseRoundTimer: () => Promise<void>;
  onExpireRoundTimer: () => Promise<void>;
  onSyncRoundTimer: () => Promise<SyncTimerOutcome | null>;
  onRecordMatchResult: (input: {
    matchId: string;
    pairAScore: number;
    pairBScore: number;
    endedBy: MatchEndReason;
    reason?: string;
  }) => Promise<void>;
  onSimulateRoundResults: () => Promise<void>;
  onCompleteRound: () => Promise<void>;
  onSubstitutePlayer: (participantId: string, substituteName: string) => Promise<void>;
  onWithdrawPlayer: (participantId: string) => Promise<void>;
}

export function ActiveTournamentScreen({
  tournament,
  standings,
  busy,
  onRequestLeave,
  onStartRoundTimer,
  onPauseRoundTimer,
  onExpireRoundTimer,
  onSyncRoundTimer,
  onRecordMatchResult,
  onSimulateRoundResults,
  onCompleteRound,
  onSubstitutePlayer,
  onWithdrawPlayer
}: ActiveTournamentScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('tables');
  const [editingMatch, setEditingMatch] = useState<PersistedMatch | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [subTargetId, setSubTargetId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null);

  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const p = participantById.get(id);
    return p ? `#${p.number} ${p.displayName}` : id;
  };

  const currentRound =
    tournament.rounds.find((r) => r.roundNumber === tournament.currentRoundNumber) ??
    tournament.rounds[tournament.rounds.length - 1];

  const isTimerRunning =
    currentRound?.timerStartedAtUtcMs !== null && currentRound?.timerStartedAtUtcMs !== undefined;

  useEffect(() => {
    const shouldKeepAwake = isTimerRunning || projectionOpen;
    void setKeepAwake(shouldKeepAwake);
    return () => {
      void setKeepAwake(false);
    };
  }, [isTimerRunning, projectionOpen]);

  const pendingMatchesCount = currentRound
    ? currentRound.matches.filter((m) => m.status !== 'completed').length
    : 0;
  const allMatchesRecorded = currentRound !== undefined && pendingMatchesCount === 0;

  const isFinalStage =
    currentRound !== undefined &&
    (currentRound.phase === 'final' ||
      currentRound.roundNumber >= tournament.plannedRounds);

  async function handleSaveMatchResult(input: {
    matchId: string;
    pairAScore: number;
    pairBScore: number;
    endedBy: MatchEndReason;
    reason?: string;
  }) {
    await onRecordMatchResult(input);
    setEditingMatch(null);
  }

  async function handleConfirmSubstitute(e: FormEvent) {
    e.preventDefault();
    if (!subTargetId || !subName.trim()) return;
    await onSubstitutePlayer(subTargetId, subName);
    setSubTargetId(null);
    setSubName('');
  }

  async function handleConfirmWithdraw(participantId: string) {
    await onWithdrawPlayer(participantId);
    setWithdrawTargetId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header with auto-save reassurance + guarded exit + projection trigger */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onRequestLeave}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Salir al inicio
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{tournament.name}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Torneo iniciado
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-0.5 text-xs font-medium text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              Guardado automático local
            </span>
          </div>

          <p className="mt-1 text-sm text-stone-500">
            {currentRound?.stageName ?? `Ronda ${tournament.currentRoundNumber}`} (Ronda{' '}
            {tournament.currentRoundNumber} de {tournament.plannedRounds}) · Meta{' '}
            {tournament.config.targetScore} pts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentRound && (
            <button
              type="button"
              onClick={() => setProjectionOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-xs transition hover:bg-stone-100"
            >
              <Maximize2 className="h-3.5 w-3.5 text-emerald-700" />
              Modo proyección
            </button>
          )}
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900">
            <Lock className="h-3.5 w-3.5" />
            Reglamento oficial congelado
          </div>
        </div>
      </div>

      {/* Persistent Round Timer */}
      {currentRound && (
        <RoundTimerPanel
          round={currentRound}
          warningBeforeEndSeconds={tournament.config.warningBeforeEndSeconds}
          busy={busy}
          onStartOrResume={onStartRoundTimer}
          onPause={onPauseRoundTimer}
          onExpireNow={onExpireRoundTimer}
          onSyncTimer={onSyncRoundTimer}
        />
      )}

      {/* Navigation Tabs (scrollable/wrapped nicely on mobile) */}
      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-2">
        {(
          [
            { id: 'tables', label: 'Mesas y resultados', icon: Table2 },
            { id: 'standings', label: 'Clasificación', icon: Award },
            { id: 'participants', label: 'Participantes', icon: Users },
            { id: 'rules_audit', label: 'Reglamento y auditoría', icon: ScrollText }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:px-4 ${
                active
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'rules_audit' && tournament.resultAuditLogs.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {tournament.resultAuditLogs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Mesas y resultados */}
      {activeTab === 'tables' && currentRound && (
        <div className="space-y-5">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
            <div className="text-xs text-stone-600">
              {allMatchesRecorded ? (
                <span className="font-semibold text-emerald-800">
                  Todas las mesas de {currentRound.stageName} tienen resultado confirmado.
                </span>
              ) : (
                <span>
                  Faltan{' '}
                  <strong className="text-stone-900">
                    {pendingMatchesCount}{' '}
                    {pendingMatchesCount === 1 ? 'mesa' : 'mesas'}
                  </strong>{' '}
                  por registrar resultado.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!allMatchesRecorded && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSimulateRoundResults()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-40"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                  Simular resultados (Prueba)
                </button>
              )}

              <button
                type="button"
                disabled={busy || !allMatchesRecorded}
                onClick={() => void onCompleteRound()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                {isFinalStage ? 'Finalizar torneo' : 'Cerrar ronda y avanzar'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentRound.matches.map((m) => {
              const completed = m.status === 'completed';
              const isDraw = m.outcome === 'draw';
              return (
                <article
                  key={m.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs ${
                    completed ? 'border-emerald-200 bg-white' : 'border-stone-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-emerald-900 px-2.5 py-0.5 text-xs font-bold text-white">
                        Mesa {m.tableNumber}
                      </span>
                      {completed ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {isDraw
                            ? `Empate (${m.pairAScore} - ${m.pairBScore})`
                            : `${m.pairAScore} - ${m.pairBScore}`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                          Pendiente
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div
                        className={`flex items-center justify-between rounded-xl p-2.5 ${
                          m.winnerPair === 'A'
                            ? 'bg-emerald-100/80 ring-1 ring-emerald-300'
                            : 'bg-emerald-50/70'
                        }`}
                      >
                        <div>
                          <p className="text-[10px] font-bold text-emerald-800 uppercase">
                            Pareja A {m.winnerPair === 'A' ? '· Ganadora' : ''}
                          </p>
                          <p className="font-medium text-stone-900">{nameOf(m.pairA[0])}</p>
                          <p className="font-medium text-stone-900">{nameOf(m.pairA[1])}</p>
                        </div>
                        {completed && (
                          <span className="text-xl font-extrabold text-stone-900 tabular-nums">
                            {m.pairAScore}
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex items-center justify-between rounded-xl p-2.5 ${
                          m.winnerPair === 'B'
                            ? 'bg-emerald-100/80 ring-1 ring-emerald-300'
                            : 'bg-stone-100'
                        }`}
                      >
                        <div>
                          <p className="text-[10px] font-bold text-stone-600 uppercase">
                            Pareja B {m.winnerPair === 'B' ? '· Ganadora' : ''}
                          </p>
                          <p className="font-medium text-stone-900">{nameOf(m.pairB[0])}</p>
                          <p className="font-medium text-stone-900">{nameOf(m.pairB[1])}</p>
                        </div>
                        {completed && (
                          <span className="text-xl font-extrabold text-stone-900 tabular-nums">
                            {m.pairBScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingMatch(m)}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      completed
                        ? 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                        : 'bg-emerald-800 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {completed ? (
                      <>
                        <Edit3 className="h-3.5 w-3.5" />
                        Corregir resultado
                      </>
                    ) : (
                      'Registrar resultado'
                    )}
                  </button>
                </article>
              );
            })}
          </div>

          {currentRound.byes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Coffee className="h-4 w-4 text-amber-700" />
                {tournament.config.format === 'qualifying_elimination' &&
                currentRound.roundNumber === 1
                  ? 'Pase libre al azar en Clasificatoria 1 (avanzan a Ronda 2)'
                  : `Descansan en ${currentRound.stageName}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentRound.byes.map((id) => (
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
        </div>
      )}

      {/* Tab 2: Clasificación en vivo */}
      {activeTab === 'standings' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">
              Tabla de clasificación en vivo
            </h2>
            <span className="text-xs text-stone-500">Recalculada desde actas confirmadas</span>
          </div>
          <StandingsTable
            rows={standings}
            highlightTopCount={
              tournament.config.format === 'qualifying_elimination' &&
              tournament.eliminationStages?.[
                currentRound?.roundNumber ? currentRound.roundNumber - 1 : 0
              ]
                ? tournament.eliminationStages[currentRound!.roundNumber - 1]!.advancesCount
                : 1
            }
          />
        </div>
      )}

      {/* Tab 3: Participantes y contingencias */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
            Si un participante debe ausentarse, puedes <strong>asignar un sustituto</strong> para
            mantener las mesas exactas sin descansos, o registrar su{' '}
            <strong>retiro administrativo</strong> para las rondas futuras sin alterar resultados
            ya completados.
          </div>

          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {tournament.participants.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs font-bold text-stone-700">
                    #{p.number}
                  </span>
                  <span className="text-sm font-semibold text-stone-900">{p.displayName}</span>
                  {p.status === 'active' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      Activo
                    </span>
                  )}
                  {p.status === 'eliminated' && (
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                      Eliminado tras R{p.eliminatedAfterRound}
                    </span>
                  )}
                  {p.status === 'withdrawn' && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                      Retirado tras R{p.withdrawnAfterRound}
                    </span>
                  )}
                  {p.isSubstitute && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                      Sustituyó a {p.substitutedForName}
                    </span>
                  )}
                </div>

                {p.status === 'active' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSubTargetId(p.id);
                        setSubName('');
                        setWithdrawTargetId(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-emerald-700" />
                      Sustituir
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setWithdrawTargetId(p.id);
                        setSubTargetId(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Retirar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {subTargetId && (
            <form
              onSubmit={handleConfirmSubstitute}
              className="flex flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:flex-row sm:items-end"
            >
              <label className="flex-1 space-y-1 text-xs font-semibold text-emerald-950">
                <span>Nombre del sustituto para {nameOf(subTargetId)}</span>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Ej. Carlos (Sustituto)"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-stone-900"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubTargetId(null)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy || !subName.trim()}
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white"
                >
                  Confirmar sustituto
                </button>
              </div>
            </form>
          )}

          {withdrawTargetId && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 sm:flex-row sm:items-center">
              <p className="text-xs text-rose-900">
                ¿Confirmas el retiro administrativo de{' '}
                <strong>{nameOf(withdrawTargetId)}</strong>? Solo se recalcularán rondas futuras.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawTargetId(null)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmWithdraw(withdrawTargetId)}
                  className="rounded-xl bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white"
                >
                  Confirmar retiro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Reglamento congelado e historial de auditoría */}
      {activeTab === 'rules_audit' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {tournament.ruleSnapshot && (
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
                  <ScrollText className="h-4 w-4 text-emerald-700" />
                  Reglamento oficial congelado
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    downloadRulesPdf(
                      tournament.name,
                      tournament.ruleSnapshot!,
                      tournament.seed
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar reglamento PDF
                </button>
              </div>
              <p className="mt-2 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
                {tournament.ruleSnapshot.summary}
              </p>
              <div className="mt-4 space-y-3">
                {tournament.ruleSnapshot.sections.map((sec) => (
                  <div key={sec.id} className="space-y-1">
                    <h3 className="text-xs font-bold text-stone-900">{sec.title}</h3>
                    <ul className="space-y-1 pl-4 text-xs text-stone-600">
                      {sec.items.map((item) => (
                        <li key={item} className="list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <History className="h-4 w-4 text-emerald-700" />
              Historial de resultados y correcciones
            </h2>
            {tournament.resultAuditLogs.length === 0 ? (
              <p className="mt-3 text-xs text-stone-500">
                Todavía no se han registrado resultados en este torneo.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5 text-xs">
                {[...tournament.resultAuditLogs].reverse().map((log) => (
                  <li
                    key={log.id}
                    className={`rounded-xl border p-3 ${
                      log.action === 'corrected'
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-stone-100 bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        Ronda {log.roundNumber} · Mesa {log.tableNumber} —{' '}
                        {log.action === 'corrected' ? 'Corrección administrativa' : 'Registro'}
                      </span>
                      <span className="font-mono">
                        {log.newPairAScore} - {log.newPairBScore}
                      </span>
                    </div>
                    {log.action === 'corrected' && (
                      <p className="mt-1 text-stone-700">
                        Marcador anterior: {log.prevPairAScore} - {log.prevPairBScore}. Motivo:{' '}
                        <strong>{log.reason}</strong>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {editingMatch && (
        <MatchResultModal
          match={editingMatch}
          targetScore={tournament.config.targetScore}
          nameOf={nameOf}
          busy={busy}
          onClose={() => setEditingMatch(null)}
          onSubmit={handleSaveMatchResult}
        />
      )}

      {projectionOpen && currentRound && (
        <ProjectionView
          tournamentName={tournament.name}
          round={currentRound}
          warningBeforeEndSeconds={tournament.config.warningBeforeEndSeconds}
          nameOf={nameOf}
          onExit={() => setProjectionOpen(false)}
        />
      )}
    </div>
  );
}
