import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { validateMatchScore, type MatchEndReason } from '../../core/index.js';
import type { PersistedMatch } from '../../application/ports/tournament-repository.js';

interface MatchResultModalProps {
  match: PersistedMatch;
  targetScore: number;
  nameOf: (participantId: string) => string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    matchId: string;
    pairAScore: number;
    pairBScore: number;
    endedBy: MatchEndReason;
    reason?: string;
  }) => Promise<void>;
}

export function MatchResultModal({
  match,
  targetScore,
  nameOf,
  busy,
  onClose,
  onSubmit
}: MatchResultModalProps) {
  const isCorrection = match.status === 'completed';

  const [pairAStr, setPairAStr] = useState(
    match.pairAScore !== null ? String(match.pairAScore) : ''
  );
  const [pairBStr, setPairBStr] = useState(
    match.pairBScore !== null ? String(match.pairBScore) : ''
  );
  const [endedBy, setEndedBy] = useState<MatchEndReason>(
    match.endedBy ?? 'target_score'
  );
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const parsedA = pairAStr.trim() === '' ? Number.NaN : Number(pairAStr);
  const parsedB = pairBStr.trim() === '' ? Number.NaN : Number(pairBStr);
  const hasBothNumbers = !Number.isNaN(parsedA) && !Number.isNaN(parsedB);

  const liveValidation = hasBothNumbers
    ? validateMatchScore({
        pairAScore: parsedA,
        pairBScore: parsedB,
        targetScore,
        endedBy
      })
    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!hasBothNumbers) {
      setLocalError('Ingresa los puntajes numéricos de ambas parejas.');
      return;
    }

    if (liveValidation && !liveValidation.valid) {
      setLocalError(liveValidation.errors.join(' '));
      return;
    }

    if (isCorrection && reason.trim().length === 0) {
      setLocalError('Debes escribir el motivo de la corrección administrativa.');
      return;
    }

    await onSubmit({
      matchId: match.id,
      pairAScore: parsedA,
      pairBScore: parsedB,
      endedBy,
      ...(isCorrection ? { reason: reason.trim() } : {})
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="match-modal-title" className="text-lg font-bold text-stone-900">
              {isCorrection
                ? `Corregir resultado — Mesa ${match.tableNumber}`
                : `Registrar resultado — Mesa ${match.tableNumber}`}
            </h2>
            <p className="text-xs text-stone-500">
              Meta: {targetScore} pts · Se registran puntos reales sin recorte
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Pair A */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs font-bold text-emerald-900 uppercase">Pareja A</p>
              <p className="mt-1 text-xs text-stone-700">{nameOf(match.pairA[0])}</p>
              <p className="text-xs text-stone-700">{nameOf(match.pairA[1])}</p>
              <label
                htmlFor="score-pair-a"
                className="mt-3 block text-xs font-semibold text-stone-700"
              >
                Puntos Pareja A
              </label>
              <input
                id="score-pair-a"
                type="number"
                min={0}
                step={1}
                value={pairAStr}
                onChange={(e) => setPairAStr(e.target.value)}
                placeholder="Ej. 114"
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-lg font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            {/* Pair B */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-bold text-stone-700 uppercase">Pareja B</p>
              <p className="mt-1 text-xs text-stone-700">{nameOf(match.pairB[0])}</p>
              <p className="text-xs text-stone-700">{nameOf(match.pairB[1])}</p>
              <label
                htmlFor="score-pair-b"
                className="mt-3 block text-xs font-semibold text-stone-700"
              >
                Puntos Pareja B
              </label>
              <input
                id="score-pair-b"
                type="number"
                min={0}
                step={1}
                value={pairBStr}
                onChange={(e) => setPairBStr(e.target.value)}
                placeholder="Ej. 82"
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-lg font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <label className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>Motivo de cierre</span>
            <select
              value={endedBy}
              onChange={(e) => setEndedBy(e.target.value as MatchEndReason)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900"
            >
              <option value="target_score">Alcanzó o superó la meta ({targetScore} pts)</option>
              <option value="time_expired">Se agotó el tiempo (terminó mano en curso)</option>
              {isCorrection && <option value="admin_override">Corrección administrativa</option>}
            </select>
          </label>

          {isCorrection && (
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>Motivo de corrección (queda en auditoría)</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Error al transcribir hoja de Mesa 1"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </label>
          )}

          {/* Live Validation Feedback */}
          {liveValidation && liveValidation.valid && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>
                {liveValidation.outcome === 'draw'
                  ? `Resultado válido: Empate por tiempo (${parsedA} - ${parsedB}), sin ganador ni perdedor.`
                  : `Gana Pareja ${liveValidation.winnerPair} (${parsedA} - ${parsedB}).`}
              </span>
            </div>
          )}

          {liveValidation && liveValidation.warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              {liveValidation.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          {(localError || (liveValidation && !liveValidation.valid)) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {localError ?? liveValidation?.errors.join(' ')}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || (liveValidation !== null && !liveValidation.valid)}
              className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              {isCorrection ? 'Guardar corrección' : 'Confirmar resultado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
