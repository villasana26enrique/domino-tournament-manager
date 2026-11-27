import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  Pencil,
  Sparkles,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { getAvailableTournamentFormats } from '../../core/index.js';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';

interface RegistrationScreenProps {
  tournament: TournamentRecord;
  busy: boolean;
  onBackHome: () => void;
  onAddParticipant: (name: string) => Promise<void>;
  onAddBulk: (rawLines: string) => Promise<void>;
  onUpdateParticipant: (participantId: string, newName: string) => Promise<void>;
  onRemoveParticipant: (participantId: string) => Promise<void>;
  onGoToPreview: () => Promise<void>;
}

const SAMPLE_NAMES = [
  'Carlos',
  'María',
  'José',
  'Ana',
  'Luis',
  'Carmen',
  'Pedro',
  'Rosa',
  'Miguel',
  'Elena',
  'Rafael',
  'Sofía',
  'Andrés',
  'Lucía',
  'Gabriel',
  'Patricia',
  'Diego',
  'Valeria',
  'Héctor',
  'Isabel',
  'Javier',
  'Laura',
  'Fernando',
  'Beatriz',
  'Ricardo'
];

export function RegistrationScreen({
  tournament,
  busy,
  onBackHome,
  onAddParticipant,
  onAddBulk,
  onUpdateParticipant,
  onRemoveParticipant,
  onGoToPreview
}: RegistrationScreenProps) {
  const [singleName, setSingleName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const count = tournament.participants.length;
  const canGenerate = count >= 4;
  const formats = count >= 4 ? getAvailableTournamentFormats(count) : null;
  const isMultipleOf4 = count >= 4 && count % 4 === 0;

  async function handleAddSingle(e: FormEvent) {
    e.preventDefault();
    if (!singleName.trim()) return;
    await onAddParticipant(singleName);
    setSingleName('');
  }

  async function handleAddBulk(e: FormEvent) {
    e.preventDefault();
    if (!bulkText.trim()) return;
    await onAddBulk(bulkText);
    setBulkText('');
  }

  async function handleSaveEdit(participantId: string) {
    if (!editingName.trim()) return;
    await onUpdateParticipant(participantId, editingName);
    setEditingId(null);
    setEditingName('');
  }

  async function handleQuickSample(sampleCount: number) {
    const names = SAMPLE_NAMES.slice(0, sampleCount).join('\n');
    await onAddBulk(names);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </button>
          <h1 className="text-2xl font-bold text-stone-900">Registro de participantes</h1>
          <p className="text-sm text-stone-500">
            Torneo: <span className="font-semibold text-stone-800">{tournament.name}</span>
          </p>
        </div>

        <button
          type="button"
          disabled={busy || !canGenerate}
          onClick={() => void onGoToPreview()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generar torneo
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Live Eligibility Banner */}
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
          !canGenerate
            ? 'border-stone-200 bg-white text-stone-600'
            : isMultipleOf4
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
        }`}
      >
        {isMultipleOf4 ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        ) : (
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="space-y-0.5">
          <p className="font-semibold">
            {count} {count === 1 ? 'participante registrado' : 'participantes registrados'}
            {canGenerate &&
              ` · ${Math.floor(count / 4)} ${Math.floor(count / 4) === 1 ? 'mesa' : 'mesas'}`}
          </p>
          <p className="text-xs opacity-90">
            {!canGenerate
              ? `Faltan ${4 - count} participantes para completar al menos 1 mesa de 4 jugadores.`
              : isMultipleOf4
                ? 'Es múltiplo exacto de 4: en el siguiente paso podrás elegir entre “Por rondas” (0 descansos) o “Clasificatoria con eliminaciones hasta la Final”.'
                : formats?.[0]?.reason}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Input Forms */}
        <div className="space-y-5 lg:col-span-2">
          <form
            onSubmit={handleAddSingle}
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <label
              htmlFor="single-participant-name"
              className="block text-sm font-semibold text-stone-900"
            >
              Nombre del participante
            </label>
            <div className="flex gap-2">
              <input
                id="single-participant-name"
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Ej. Enrique Villasana"
                maxLength={80}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <button
                type="submit"
                disabled={busy || singleName.trim().length === 0}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                <UserPlus className="h-4 w-4" />
                Añadir jugador
              </button>
            </div>
          </form>

          <form
            onSubmit={handleAddBulk}
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="bulk-participant-list"
                className="block text-sm font-semibold text-stone-900"
              >
                Pegar lista de jugadores
              </label>
              <span className="text-xs text-stone-400">1 nombre por línea</span>
            </div>
            <textarea
              id="bulk-participant-list"
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Carlos\nMaría\nJosé\nAna'}
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <button
              type="submit"
              disabled={busy || bulkText.trim().length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-40"
            >
              Agregar lista
            </button>
          </form>

          {count === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-stone-100/70 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Cargar grupo de prueba rápido
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[12, 15, 16, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleQuickSample(n)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-emerald-500 hover:text-emerald-800"
                  >
                    {n} jugadores
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Registered Roster */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <Users className="h-4 w-4 text-emerald-700" />
              Lista inscrita ({count})
            </h2>
            <span className="text-xs text-stone-400">Numeración automática</span>
          </div>

          {count === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 py-14 text-center text-sm text-stone-400">
              Aún no hay jugadores registrados en este torneo.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {tournament.participants.map((p) => {
                const isEditing = editingId === p.id;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-700">
                        #{p.number}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveEdit(p.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="w-full rounded-lg border border-emerald-500 px-2.5 py-1 text-sm text-stone-900 focus:outline-none"
                        />
                      ) : (
                        <span className="truncate text-sm font-medium text-stone-800">
                          {p.displayName}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(p.id)}
                          aria-label="Guardar nombre"
                          className="rounded-lg bg-emerald-700 p-1.5 text-white hover:bg-emerald-600"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditingName(p.displayName);
                          }}
                          aria-label={`Editar ${p.displayName}`}
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRemoveParticipant(p.id)}
                        aria-label={`Retirar ${p.displayName}`}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
