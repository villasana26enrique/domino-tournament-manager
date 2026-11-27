import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Download, HardDrive, Upload, X } from 'lucide-react';
import type {
  BackupImportSummary,
  TournamentBackupPayload
} from '../../application/tournament-service.js';

interface BackupModalProps {
  busy: boolean;
  tournamentCount: number;
  onClose: () => void;
  onExportBackup: () => Promise<TournamentBackupPayload | null>;
  onImportBackup: (rawJson: string) => Promise<BackupImportSummary>;
}

export function BackupModal({
  busy,
  tournamentCount,
  onClose,
  onExportBackup,
  onImportBackup
}: BackupModalProps) {
  const [rawJson, setRawJson] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleDownloadJson() {
    setLocalError(null);
    setStatusMessage(null);
    const payload = await onExportBackup();
    if (!payload) return;

    const json = JSON.stringify(payload, null, 2);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `respaldo-domino-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setStatusMessage(
      `Respaldo exportado (${payload.tournaments.length} ${
        payload.tournaments.length === 1 ? 'torneo' : 'torneos'
      }).`
    );
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setStatusMessage(null);
    const text = await file.text();
    setRawJson(text);
  }

  async function handleRestore(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setStatusMessage(null);
    if (!rawJson.trim()) {
      setLocalError('Selecciona un archivo .json o pega el contenido del respaldo.');
      return;
    }

    try {
      const summary = await onImportBackup(rawJson);
      setStatusMessage(
        `Restauración completada: ${summary.importedCount} importado(s), ${summary.updatedCount} actualizado(s). Total en equipo: ${summary.totalAfter}.`
      );
      setRawJson('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo restaurar el respaldo.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 id="backup-modal-title" className="text-lg font-bold text-stone-900">
                Respaldo y restauración local
              </h2>
              <p className="text-xs text-stone-500">
                Guarda una copia de tus torneos en un archivo JSON o restáurala en otro equipo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Export Section */}
        <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-bold text-stone-800">1. Exportar respaldo</p>
          <p className="mt-1 text-xs text-stone-600">
            Actualmente hay <strong>{tournamentCount}</strong>{' '}
            {tournamentCount === 1 ? 'torneo guardado' : 'torneos guardados'} localmente.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDownloadJson()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Descargar respaldo (.json)
          </button>
        </div>

        {/* Import Section */}
        <form onSubmit={handleRestore} className="mt-4 space-y-3 rounded-2xl border border-stone-200 p-4">
          <p className="text-xs font-bold text-stone-800">2. Restaurar desde respaldo</p>
          <label className="block text-xs text-stone-600">
            <span>Seleccionar archivo .json</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleFileSelect(e)}
              className="mt-1.5 block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-stone-700 hover:file:bg-stone-200"
            />
          </label>

          <label className="block space-y-1 text-xs text-stone-600">
            <span>Pegar respaldo JSON</span>
            <textarea
              rows={4}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder='{"schemaVersion": "1.0.0", ...}'
              className="w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-[11px] text-stone-900 focus:border-emerald-700 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            Restaurar respaldo
          </button>
        </form>

        {localError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {localError}
          </p>
        )}

        {statusMessage && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{statusMessage}</span>
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
