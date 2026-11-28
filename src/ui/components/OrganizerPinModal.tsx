import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, ShieldCheck, ShieldOff, Unlock } from 'lucide-react';
import { validatePinFormat } from '../../infrastructure/organizer-pin.js';
import { useI18n } from '../../i18n/context.js';
import { localizePinError } from '../../i18n/domain-labels.js';

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
  const { locale, t } = useI18n();
  const [pinInput, setPinInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    const formatError = localizePinError(validatePinFormat(pinInput), locale);
    if (formatError) {
      setError(formatError);
      return;
    }
    if (pinInput.trim() !== confirmInput.trim()) {
      setError(t.pinModal.mismatchError);
      return;
    }
    onSetPin(pinInput.trim());
    onClose();
  }

  function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onVerifyAndUnlock(pinInput.trim())) {
      setError(t.pinModal.wrongPinError);
      return;
    }
    onClose();
  }

  function handleClearSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onClearPin(pinInput.trim())) {
      setError(t.pinModal.clearWrongPinError);
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
                ? t.pinModal.setupTitle
                : mode === 'unlock'
                  ? t.pinModal.unlockTitle
                  : t.pinModal.manageTitle}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {mode === 'setup'
                ? t.pinModal.setupDesc
                : mode === 'unlock'
                  ? actionDescription
                    ? t.pinModal.unlockActionDesc(actionDescription)
                    : t.pinModal.unlockGenericDesc
                  : t.pinModal.manageDesc}
            </p>
          </div>
        </div>

        {mode === 'setup' && (
          <form onSubmit={handleSetupSubmit} className="mt-5 space-y-3">
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t.pinModal.newPinLabel}</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError(null);
                }}
                placeholder={t.pinModal.newPinPlaceholder}
                autoFocus
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm tracking-widest text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t.pinModal.confirmPinLabel}</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmInput}
                onChange={(e) => {
                  setConfirmInput(e.target.value);
                  setError(null);
                }}
                placeholder={t.pinModal.confirmPinPlaceholder}
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
                {t.pinModal.cancel}
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Lock className="h-3.5 w-3.5" />
                {t.pinModal.saveAndLock}
              </button>
            </div>
          </form>
        )}

        {mode === 'unlock' && (
          <form onSubmit={handleUnlockSubmit} className="mt-5 space-y-3">
            <label className="block space-y-1 text-xs font-semibold text-stone-700">
              <span>{t.pinModal.enterPinLabel}</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setError(null);
                }}
                placeholder={t.pinModal.enterPinPlaceholder}
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
                {t.pinModal.cancel}
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Unlock className="h-3.5 w-3.5" />
                {t.pinModal.unlockButton}
              </button>
            </div>
          </form>
        )}

        {mode === 'manage' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-xs font-medium text-emerald-950">
                {t.pinModal.activeBanner}
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
                {t.pinModal.lockNow}
              </button>
            </div>

            <form
              onSubmit={handleClearSubmit}
              className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5"
            >
              <label className="block space-y-1 text-xs font-semibold text-stone-700">
                <span>{t.pinModal.currentPinLabel}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={t.pinModal.currentPinPlaceholder}
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
                  {t.pinModal.close}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  {t.pinModal.removePin}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
