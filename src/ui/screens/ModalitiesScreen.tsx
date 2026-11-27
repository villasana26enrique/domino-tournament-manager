import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

interface ModalitiesScreenProps {
  onBackHome: () => void;
}

export function ModalitiesScreen({ onBackHome }: ModalitiesScreenProps) {
  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </button>
        <h1 className="text-2xl font-bold text-stone-900">Modalidades y reglamentos</h1>
        <p className="mt-1 text-sm text-stone-500">
          Guía clara de los formatos disponibles en esta versión y de las modalidades previstas para
          futuras versiones.
        </p>
      </div>

      {/* Implemented */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-wide text-emerald-800 uppercase">
          Implementada en el MVP
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">
                Individual con parejas rotativas — Por rondas
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Disponible
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              Ideal cuando la cantidad de jugadores es <strong>múltiplo de 4</strong> (8, 12, 16,
              20, 24...). Todos disputan exactamente las mismas rondas con{' '}
              <strong>0 descansos</strong> y sin eliminaciones, rotando de compañero en cada ronda.
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">
                Individual con parejas rotativas — Clasificatoria + Eliminaciones
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Disponible
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              Disponible para <strong>cualquier cantidad desde 4 jugadores</strong>. Inicia con 2
              rondas clasificatorias (si no es múltiplo de 4, quienes descansan al azar en R1 tienen
              pase libre y juegan R2), corta a múltiplo exacto de 4 (16 → 8 → 4) con 0 descansos y
              cierra con una <strong>Gran Final de 1 sola partida</strong>.
            </p>
          </article>
        </div>
      </section>

      {/* Planned */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">Próximamente</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Parejas fijas',
              desc: 'Los equipos de dos jugadores permanecen juntos durante todo el campeonato.'
            },
            {
              title: 'Sistema suizo extendido',
              desc: 'Emparejamientos competitivos puros para eventos largos de clubes.'
            },
            {
              title: 'Ligas y ranking histórico',
              desc: 'Acumulado de varias jornadas con estadísticas históricas por club.'
            }
          ].map((mod) => (
            <article
              key={mod.title}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-800">{mod.title}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                  <Clock className="h-3 w-3" />
                  Prevista
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">{mod.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Core Rules Explainer */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-bold text-stone-900">
          Reglas generales de puntuación, tiempo y contingencias
        </h2>
        <ul className="mt-3 space-y-2 pl-5 text-xs leading-relaxed text-stone-600">
          <li className="list-disc">
            <strong>Meta de 100 puntos sin recorte:</strong> si una pareja termina con 133 puntos
            contra 84, se registran exactamente 133 y 84 para el diferencial individual.
          </li>
          <li className="list-disc">
            <strong>Cierre por tiempo (25 min):</strong> al sonar la alarma se termina solo la mano
            en curso y se anotan los puntos exactos. Si hay igualdad de puntos, queda registrada
            como empate (0.5 puntos de partida, sin muerte súbita).
          </li>
          <li className="list-disc">
            <strong>Si alguien debe retirarse a mitad del torneo:</strong> el organizador puede
            asignar un sustituto (conservando mesas exactas sin descansos) o registrar retiro
            administrativo recalculando solo rondas futuras.
          </li>
        </ul>
      </section>
    </div>
  );
}
