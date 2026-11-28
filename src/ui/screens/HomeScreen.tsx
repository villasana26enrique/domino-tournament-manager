import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  HardDrive,
  Plus,
  Trash2,
  Trophy,
  Users
} from 'lucide-react';
import type { TournamentRecord } from '../../application/ports/tournament-repository.js';
import { useI18n } from '../../i18n/context.js';

interface HomeScreenProps {
  tournaments: TournamentRecord[];
  busy: boolean;
  onCreateTournament: (name: string) => Promise<void>;
  onOpenTournament: (tournament: TournamentRecord) => void;
  onRequestDeleteTournament: (tournament: TournamentRecord) => void;
  onOpenBackup: () => void;
  onOpenModalities: () => void;
}

const STATUS_BADGE_CLASS: Record<TournamentRecord['status'], string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  ready: 'bg-sky-100 text-sky-800 border-sky-200',
  in_progress: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-stone-200 text-stone-700 border-stone-300',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200'
};

export function HomeScreen({
  tournaments,
  busy,
  onCreateTournament,
  onOpenTournament,
  onRequestDeleteTournament,
  onOpenBackup,
  onOpenModalities
}: HomeScreenProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateTournament(name);
    setName('');
  }

  const activeOrDraft = tournaments.filter(
    (item) => item.status === 'in_progress' || item.status === 'draft' || item.status === 'ready'
  );
  const completed = tournaments.filter((item) => item.status === 'completed');

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero + Create Form */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 p-5 text-white shadow-lg sm:p-8">
        <div className="grid gap-6 lg:grid-cols-5 lg:items-center lg:gap-8">
          <div className="space-y-3 lg:col-span-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
              <Trophy className="h-3.5 w-3.5" />
              {t.home.badge}
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
              {t.home.heroTitle}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-emerald-100/90 sm:text-base">
              {t.home.heroDescription}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm sm:p-5 lg:col-span-2"
          >
            <label
              htmlFor="new-tournament-name"
              className="block text-sm font-semibold text-white"
            >
              {t.home.tournamentNameLabel}
            </label>
            <input
              id="new-tournament-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.home.tournamentNamePlaceholder}
              maxLength={80}
              className="w-full rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
            />
            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t.home.createButton}
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active & Draft Tournaments */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">{t.home.activeSectionTitle}</h2>
            <span className="text-xs font-medium text-stone-500">
              {activeOrDraft.length}{' '}
              {activeOrDraft.length === 1 ? t.home.recordSingular : t.home.recordPlural}
            </span>
          </div>

          {activeOrDraft.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <Users className="mx-auto h-9 w-9 text-stone-400" />
              <p className="mt-3 text-sm font-medium text-stone-700">{t.home.emptyTitle}</p>
              <p className="mt-1 text-xs text-stone-500">{t.home.emptyDescription}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrDraft.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition hover:border-emerald-300 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-stone-900">{item.name}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[item.status]}`}
                      >
                        {t.home.status[item.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t.home.participantsCount(item.participants.length)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {item.config.format === 'rounds_all_play'
                          ? t.home.formatRounds
                          : t.home.formatElimination}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTournament(item)}
                      aria-label={t.home.deleteAria(item.name)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.home.deleteButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTournament(item)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:flex-none"
                    >
                      {item.status === 'in_progress'
                        ? t.home.continueTournament
                        : t.home.openDraft}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3 pt-4">
              <h2 className="text-lg font-semibold text-stone-900">
                {t.home.completedSectionTitle}
              </h2>
              {completed.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">{item.name}</h3>
                    <p className="text-xs text-stone-500">
                      {t.home.completedMeta(item.participants.length, item.plannedRounds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRequestDeleteTournament(item)}
                      aria-label={t.home.deleteAria(item.name)}
                      className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.home.deleteButton}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTournament(item)}
                      className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                    >
                      {t.home.viewSummary}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Sidebar Info Cards */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-900">
              {t.home.sidebarModalitiesTitle}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              {t.home.sidebarModalitiesDesc}
            </p>
            <button
              type="button"
              onClick={onOpenModalities}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              {t.home.viewModalitiesButton}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-emerald-700" />
              <h2 className="text-sm font-semibold text-stone-900">
                {t.home.sidebarBackupTitle}
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
              {t.home.sidebarBackupDesc}
            </p>
            <button
              type="button"
              onClick={onOpenBackup}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-100"
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t.home.backupButton}
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-100/70 p-5 text-xs text-stone-600">
            <p className="font-semibold text-stone-800">{t.home.sidebarTimeRuleTitle}</p>
            <p className="mt-1 leading-relaxed">{t.home.sidebarTimeRuleDesc}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
