import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';

interface ModalitiesScreenProps {
  onBackHome: () => void;
}

export function ModalitiesScreen({ onBackHome }: ModalitiesScreenProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.modalities.backHome}
        </button>
        <h1 className="text-2xl font-bold text-stone-900">{t.modalities.title}</h1>
        <p className="mt-1 text-sm text-stone-500">{t.modalities.subtitle}</p>
      </div>

      {/* Implemented */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-wide text-emerald-800 uppercase">
          {t.modalities.implementedHeading}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-stone-900">{t.modalities.roundsTitle}</h3>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t.modalities.availableBadge}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              {t.modalities.roundsDesc}
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-stone-900">{t.modalities.elimTitle}</h3>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t.modalities.availableBadge}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">{t.modalities.elimDesc}</p>
          </article>
        </div>
      </section>

      {/* Planned */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">
          {t.modalities.plannedHeading}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {t.modalities.plannedItems.map((mod) => (
            <article
              key={mod.title}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-800">{mod.title}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                  <Clock className="h-3 w-3" />
                  {t.modalities.plannedBadge}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">{mod.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Core Rules Explainer */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-bold text-stone-900">{t.modalities.coreRulesTitle}</h2>
        <ul className="mt-3 space-y-2 pl-5 text-xs leading-relaxed text-stone-600">
          {t.modalities.coreRulesItems.map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
