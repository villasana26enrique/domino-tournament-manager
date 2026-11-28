import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';

interface LeaveTournamentModalProps {
  tournamentName: string;
  timerRunning: boolean;
  onStay: () => void;
  onConfirmLeave: () => void;
}

export function LeaveTournamentModal({
  tournamentName,
  timerRunning,
  onStay,
  onConfirmLeave
}: LeaveTournamentModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-modal-title"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="leave-modal-title" className="text-lg font-bold text-stone-900">
              {t.leaveModal.title}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {t.leaveModal.subtitlePrefix}{' '}
              <span className="font-semibold text-stone-900">{tournamentName}</span>.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950">
          <p className="flex items-start gap-2 font-medium">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span>{t.leaveModal.reassurance}</span>
          </p>
          {timerRunning && <p className="pl-6 text-amber-900">{t.leaveModal.timerRunningNote}</p>}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {t.leaveModal.stayButton}
          </button>
          <button
            type="button"
            onClick={onConfirmLeave}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            {t.leaveModal.leaveButton}
          </button>
        </div>
      </div>
    </div>
  );
}
