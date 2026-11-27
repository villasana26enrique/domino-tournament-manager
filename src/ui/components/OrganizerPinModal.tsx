import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, ShieldCheck, ShieldOff, Unlock } from 'lucide-react';
import { validatePinFormat } from '../../infrastructure/organizer-pin.js';

export type OrganizerPinModalMode = 'setup' | 'unlock' | 'manage';

interface OrganizerPinModalProps {
  mode: OrganizerPinModalMode;
  actionDescription?: string;
  onClose: () => void;
  onSetPin: (pin: string) => void;
  onVerifyAndUnlock: (pin: string) => boolean;
  onLockNow: () => void;
  onClearPin: (currentPin: string) => boolean;
}

export function OrganizerPinModal({
  mode,
  actionDescription,
  onClose,
  onSetPin,
  onVerifyAndUnlock,
  onLockNow,
  onClearPin
}: OrganizerPinModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    const formatError = validatePinFormat(pinInput);
    if (formatError) {
      setError(formatError);
      return;
    }
    if (pinInput.trim() !== confirmInput.trim()) {
      setError('Los dos campos de PIN no coinciden.');
      return;
    }
    onSetPin(pinInput.trim());
    onClose();
  }

  function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onVerifyAndUnlock(pinInput.trim())) {
      setError('PIN incorrecto. Verifica e intenta de nuevo.');
      return;
    }
    onClose();
  }

  function handleClearSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onClearPin(pinInput.trim())) {
      setError('PIN incorrecto. No se pudo quitar la protección.');
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-pin-modal-title"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            {mode === 'unlock' ? (
              <Lock className="h-5 w-5" />
            ) : mode === 'manage' ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <KeyRound className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 id="organizer-pin-modal-title" className="text-lg font-bold text-stone-900">
              {mode === 'setup'
                ? 'Proteger con PIN de organizador'
                : mode === 'unlock'
                  ? 'PIN de organizador'
                  : 'Modo organizador desbloqueado'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {mode === 'setup'
                ? 'Crea un PIN local de 4 a 6 dígitos (sin cuentas ni login) para ocultar herramientas de prueba y proteger eliminación, correcciones y retiros.'
                : mode === 'unlock'
                  ? actionDescription
                    ? `Ingresa el PIN de organizador para ${actionDescription}.`
                    : 'Ingresa tu PIN local de 4 a 6 dígitos para desbloquear acciones de organizador.'
                  : 'Las acciones sensibles están habilitadas en esta sesión. Puedes volver a bloquearlas en cualquier momento o quitar el PIN.'}
            </p>
          </div>
        </div>

        {mode === 'setup' && (
          <form onSubmit={handleSetupSubmit} className="mt-5 space-y-3">
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>Nuevo PIN (4 a 6 dígitos)</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError(null);
                }}
                placeholder="Ej. 2468"
                autoFocus
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>Confirmar PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmInput}
                onChange={(e) => {
                  setConfirmInput(e.target.value);
                  setError(null);
                }}
                placeholder="Repite el PIN"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Lock className="h-3.5 w-3.5" />
                Guardar y bloquear
              </button>
            </div>
          </form>
        )}

        {mode === 'unlock' && (
          <form onSubmit={handleUnlockSubmit} className="mt-5 space-y-3">
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>Ingresa el PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError(null);
                }}
                placeholder="4 a 6 dígitos"
                autoFocus
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Unlock className="h-3.5 w-3.5" />
                Desbloquear
              </button>
            </div>
          </form>
        )}

        {mode === 'manage' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-xs font-medium text-emerald-950">
                Protección activa para esta máquina
              </span>
              <button
                type="button"
                onClick={() => {
                  onLockNow();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
              >
                <Lock className="h-3.5 w-3.5" />
                Bloquear ahora
              </button>
            </div>

            <form
              onSubmit={handleClearSubmit}
              className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5"
            >
              <label className="block space-y-1 text-xs font-semibold text-stone-700">
                <span>PIN actual para confirmar (si deseas quitar el PIN)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="PIN actual"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Quitar PIN
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
