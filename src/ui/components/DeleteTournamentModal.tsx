import { AlertTriangle, Trash2 } from 'lucide-react';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';
import { useI18n } from '../../i18n/context.js';

interface DeleteTournamentModalProps {
  tournament: TournamentRecord;
  busy: boolean;
  onCancel: () => void;
  onConfirmDelete: () => Promise<void>;
}

export function DeleteTournamentModal({
  tournament,
  busy,
  onCancel,
  onConfirmDelete
}: DeleteTournamentModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="delete-modal-title" className="text-lg font-bold text-stone-900">
              {t.deleteModal.title}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {t.deleteModal.subtitlePrefix}{' '}
              <span className="font-semibold text-stone-900">{tournament.name}</span>.
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-relaxed text-rose-900">
          {t.deleteModal.warnings[tournament.status]} {t.deleteModal.irreversibleSuffix}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            {t.deleteModal.cancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirmDelete()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t.deleteModal.confirmDelete}
          </button>
        </div>
      </div>
    </div>
  );
}
