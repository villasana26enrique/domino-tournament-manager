# Registro de Decisiones Técnicas y de Producto (DECISIONS.md)

Este documento registra las decisiones arquitectónicas (ADR), matemáticas y de reglamento del proyecto **Domino Tournament Manager**.

---

## ADR-001 — Stack desktop y separación de responsabilidades

- **Estado:** Aprobado (Fase 0)
- **Decisión:** `React + TypeScript + Vite + Tauri v2 + SQLite (rusqlite en Rust)` con motor de competición 100% en TypeScript puro (`src/core/`).
- **Motivo:** Instalador ligero y bajo consumo de RAM para laptops modestas de clubes/vecinos; un único lenguaje para dominio, algoritmos, validaciones Zod y pruebas Vitest; transacciones ACID reales en Rust (`WAL` + `synchronous=FULL`) evitando problemas de pool de `@tauri-apps/plugin-sql`.
- **Consecuencias:** La capa `src/core/` no puede importar React, Tauri ni SQLite. Toda prueba algorítmica y de auditoría se ejecuta headless en Node.

## ADR-002 — Cierre por tiempo y empates en partidas

- **Estado:** Aprobado por Enrique (Fase 0)
- **Decisión:** Al agotarse el tiempo de la ronda, cada mesa culmina únicamente la mano en curso y registra la puntuación exacta resultante. Si al finalizar esa mano ambas parejas quedan igualadas en puntos, **la partida queda empatada (`draw`), sin ganador ni perdedor y sin mano de muerte súbita**.
- **Motivo:** Mantiene el ritmo ágil del torneo social sin alargar las transiciones entre rondas y refleja la regla elegida explícitamente por el organizador.

## ADR-003 — Clasificación (con empates y cuando hay distinta cantidad de partidas)

- **Estado:** Aprobado (Fase 0)
- **Decisión:** Cada victoria suma `1.0` punto de partida (`matchPoints`), cada empate por tiempo suma `0.5` y cada derrota `0.0`.
  - Si todos disputan la misma cantidad de partidas (`equal_games`): `Puntos de partida (V + 0.5·E)` → `Victorias` → `Diferencia total (PF - PC)` → `Puntos a favor (PF)` → `Enfrentamiento directo` → `Desempate final`.
  - Si hay diferencia de partidas (`unequal_games`): `% de efectividad ((V + 0.5·E) / PJ)` → `Puntos de partida (V + 0.5·E)` → `Victorias` → `Diferencia promedio por partida` → `Puntos promedio a favor` → `Menor número de derrotas` → `Enfrentamiento directo` → `Desempate final`.
- **Motivo:** Cuando no ocurren empates se reduce exactamente a victorias y `% de victorias`; cuando ocurren empates, ningún equipo recibe una derrota ni una victoria injusta. Además, incluir `Puntos de partida` tras `% de efectividad` evita que un `4-0` supere a un `5-0` al 100%. El criterio se congela en un snapshot inmutable antes de iniciar.

## ADR-004 — Planificación modular de descansos y no-consecutividad

- **Estado:** Aprobado (Fase 0)
- **Decisión:** Cuando $B = N - 4M > 0$, los descansos se planifican con rotación modular sobre una permutación con semilla (`xoshiro128**`).
- **Propiedad demostrada:** Siempre que $M = \lfloor N/4 \rfloor$, se cumple $2B < N$, garantizando matemáticamente diferencia máxima de descansos $\le 1$ y **cero descansos consecutivos** para cualquier $N \ge 4$ y cualquier $R \ge 1$. Si una restricción física de mesas fuerza $B > A$, los descansos consecutivos son inevitables y el sistema lo advierte explícitamente.

## ADR-005 — Motor de emparejamiento híbrido con búsqueda local determinista

- **Estado:** Aprobado (Fase 0)
- **Decisión:** Enfoque **híbrido competitivo** por defecto (descansos planificados al inicio + cruces generados ronda a ronda con búsqueda local multi-start y simulated annealing corto con evaluación incremental $O(1)$), más opción de **calendario fijo previo**.
- **Jerarquía de costos:** Repetición de compañero ($W_P = 10{,}000$, cuadrático) $\gg$ Repetición de rival ($W_O = 120$, cuadrático) $>$ Emparejamiento competitivo progresivo ($W_C(r) \in [0, 25]$) $>$ Repetición de mesa física ($W_T = 2$).
- **Balance interno de mesa:** En rondas competitivas se favorece emparejar `1.º+4.º vs 2.º+3.º` para maximizar justicia individual.
- **Determinismo:** Todo uso de aleatoriedad depende exclusivamente de un PRNG propio con semilla (`xoshiro128**` + `splitmix32`), prohibiendo `Math.random()`.

## ADR-006 — Sustitución y retiro administrativo a mitad de torneo

- **Estado:** Actualizado y aprobado por Enrique (Fase 1)
- **Decisión:** Si un participante abandona un torneo en curso (especialmente en modalidad *Por rondas*, múltiplo de 4), el organizador dispone de dos salidas sin bloquear el campeonato ni alterar rondas pasadas:
  1. **Asignar sustituto (`substituteParticipant`):** Un reemplazo ocupa el puesto del jugador ausente, preservando el múltiplo de 4, el número exacto de mesas y 0 descansos.
  2. **Retiro sin sustituto (`withdrawn`):** Contingencia que recalcula únicamente las mesas y descansos de rondas futuras sin modificar resultados completados.

## ADR-007 — Validación física de puntuaciones en dominó

- **Estado:** Aprobado (Fase 0)
- **Decisión:**
  - Bloqueos duros: puntajes negativos, no enteros, empate cuando `endedBy = 'target_score'` (imposible alcanzar la meta empatados), ambas parejas $\ge$ objetivo (físicamente imposible en dominó porque solo una pareja anota por mano).
  - Empates permitidos: `pairAScore === pairBScore` es válido cuando `endedBy = 'time_expired'` o `'admin_override'` (resultado `draw`, sin ganador ni perdedor).
  - Advertencias suaves confirmables: puntaje ganador superior a `objetivo + 85` (posible error de digitación) o partida finalizada por `target_score` sin que nadie alcance el objetivo.

## ADR-008 — Dos modalidades en el MVP: "Por rondas" (solo múltiplos de 4) y "Clasificatoria con eliminaciones hasta la Final"

- **Estado:** Aprobado por Enrique (Fase 1)
- **Decisión:** Al armar el torneo el sistema ofrece dos modalidades claras según el número de participantes $N$:
  1. **Por rondas (`rounds_all_play`):** Disponible **únicamente cuando $N \bmod 4 = 0$** (ej. 4, 8, 12, 16, 20, 24, 40). Todos juegan exactamente las mismas rondas con **0 descansos** y 0 eliminaciones.
  2. **Clasificatoria con eliminaciones hasta la Final (`qualifying_elimination`):** Disponible para **cualquier $N \ge 4$** (obligatoria cuando $N \bmod 4 \ne 0$ para evitar que alguien termine un torneo corto con desventaja definitiva por descansar).
     - Consta de **2 rondas clasificatorias** (si $N \bmod 4 \ne 0$, los $N \bmod 4$ jugadores elegidos al azar en R1 obtienen pase libre a R2 y juegan obligatoriamente en R2; hacer 2 rondas clasificatorias rota las parejas para que el corte a múltiplo de 4 no divida por azar a compañeros empatados en R1).
     - Luego se corta a un cuadro eliminatorio exacto múltiplo de 4 con **0 descansos**: `Top 16 (Cuartos) → Top 8 (Semifinal) → Top 4 (Gran Final)` (o `Top 8 → Top 4` para $8 \le N \le 15$; directo `Top 4` para $4 \le N \le 7$). En cada fase eliminatoria avanzan las parejas ganadoras de cada mesa.
     - **Gran Final de 1 sola partida:** Los 4 finalistas juegan 1 partida decisiva; se proclama la **Pareja Ganadora de la Final** y, entre sus 2 integrantes, el **Campeón Individual** según rendimiento acumulado del torneo.
- **Motivo:** Elimina la injusticia percibida de los descansos desiguales en torneos cortos no múltiplos de 4, mantiene la duración en 3–5 rondas (~1h 30m – 2h 30m) y da un cierre emocionante con Gran Final.

## ADR-009 — TDD estricto, adaptador dual de persistencia y `src/core/` libre de dependencias Node

- **Estado:** Aprobado (Fase 2)
- **Decisión:**
  1. Toda nueva capa desde Fase 2 se desarrolla mediante **TDD estricto (Rojo → Verde → Refactor)**, documentado en `AGENTS.md` y `TEST_REPORT.md`.
  2. La capa `src/infrastructure/` provee `TauriSqliteRepository` (para desktop Tauri v2 + `rusqlite` WAL), `BrowserLocalRepository` (para vista previa web inmediata vía Vite) e `InMemoryTournamentRepository` (para pruebas rápidas).
  3. `src/core/` no importa módulos `node:*` (usa `globalThis.performance.now()`), garantizando compatibilidad directa tanto en Node CLI como en el bundle del navegador/WebView2.

## ADR-010 — Cronómetro wall-clock persistente, guardia de salida en torneo activo y auditoría de correcciones

- **Estado:** Aprobado (Fase 3)
- **Decisión:**
  1. **Cronómetro (`src/core/timer/round-timer.ts`):** El tiempo restante se deriva de `elapsedBeforeRunMs + max(0, nowUtcMs - timerStartedAtUtcMs)` y persiste `warningFiredAtUtcMs` y `expiredFiredAtUtcMs`. Al recuperarse tras cierre o suspensión: si ya venció, dispara únicamente la alarma final (nunca la alerta de 5 min atrasada); si el reloj retrocede, conserva el acumulado sin valores negativos.
  2. **Guardia de navegación en torneo `in_progress`:** Cualquier intento de abandonar la pantalla activa (`Salir al inicio`, botón `Inicio`, logo o `Modalidades y reglamentos`) abre `LeaveTournamentModal` pidiendo confirmación explícita y tranquilizando al usuario respecto al guardado automático local; además `beforeunload` protege el cierre accidental mientras el reloj corre.
  3. **Auditoría y contingencias:** Todo registro o corrección administrativa genera una entrada inmutable en `resultAuditLogs` (exigiendo motivo al corregir) y recalcula la clasificación desde cero; los registros legacy de Fase 2 sin `resultAuditLogs` o `finalChampion` se normalizan automáticamente al leer del repositorio.

## ADR-011 — Eliminación confirmada, PDF offline, Modo Proyección, Respaldo local y Backlog de PIN organizador

- **Estado:** Aprobado (Fase 4)
- **Decisión:**
  1. **Eliminación de torneos (`deleteTournament`):** Disponible para borradores, torneos en curso y finalizados, siempre mediada por `DeleteTournamentModal` con advertencia contextual por estado. `deleteDraft` se conserva en la API para protección programática de borradores.
  2. **Exportación PDF 100% offline (`jsPDF` + `jspdf-autotable`):** Genera bytes binarios PDF directamente en el cliente tanto para el Reglamento Oficial como para el Reporte Final (campeón, estadísticas, tabla, rondas y correcciones), sin depender de internet ni impresoras virtuales.
  3. **Respaldo y portabilidad (`exportBackupPayload` / `importBackupPayload`):** Formato JSON versionado (`schemaVersion: "1.0.0"`) validado con Zod que fusiona torneos sin borrar otros registros locales.
  4. **Modo Proyección Fullscreen (`ProjectionView`) + Keep-Awake Windows (`SetThreadExecutionState`):** Vista de alto contraste para proyectores y prevención de suspensión en Windows mientras el cronómetro o proyección estén activos.
  5. **Backlog acordado (Fase 5 / Post-MVP sin login):** Incorporar un **código/PIN local de organizador** (sin cuentas ni servidor) para proteger acciones sensibles (eliminar torneos, correcciones administrativas y herramientas de prueba como `Simular resultados (Prueba)`).

## ADR-012 — Descansos de Clasificatoria 2 asignados prioritariamente a ganadores de Ronda 1

- **Estado:** Aprobado (Post-Fase 4)
- **Contexto:** En la modalidad `qualifying_elimination` cuando $N \bmod 4 \ne 0$, los descansos de Ronda 2 (Clasificatoria 2) se preasignaban aleatoriamente entre quienes no descansaron en Ronda 1. Si un perdedor de Ronda 1 (`0-1`) resultaba elegido para descansar en Ronda 2, cerraba la fase clasificatoria con 1 derrota y 0 victorias sin oportunidad de jugar su segunda partida para intentar remontar a `1-1`.
- **Decisión:** Implementar `selectQualifyingRound2Byes` en `src/core/algorithms/elimination-planner.ts` (consumido por `tournament-simulator.ts` y `TournamentService.completeRoundAndAdvance`):
  1. Excluir siempre a quienes ya descansaron en Ronda 1 (0 descansos consecutivos mientras $N \ge 4$).
  2. Ordenar a los candidatos elegibles por **victorias descendente (`1-0` primero)** → empates descendente → diferencial de puntos descendente → desempate determinista con `SeededRng(`${seed}::qualifying-r2-byes`)`.
  3. Mantener intacto el caso borde $N = 7$ (2 ganadores de R1 para 3 descansos): descansan ambos ganadores más 1 elegible que no descansó en R1.
  4. Actualizar los textos explicativos en `tournament-planner.ts` y `rule-generator.ts`.
- **Motivo:** Garantiza que todo perdedor de Ronda 1 juegue su segunda partida clasificatoria para intentar llegar a `1-1`, mientras quienes ya aseguraron `1-0` en Ronda 1 mantienen su invicto (100% de victorias) si descansan en Ronda 2.

## ADR-013 — Modo Organizador con PIN local, Llave Visual por Fases y Pruebas E2E Playwright (Fase 5)

- **Estado:** Aprobado (Fase 5)
- **Decisión:**
  1. **Modo Organizador con PIN local (`src/infrastructure/organizer-pin.ts` + `OrganizerPinModal`):** Sin cuentas ni login. El PIN de 4–6 dígitos se almacena localmente como hash con sal (`domino_tm_organizer_pin_v1`, nunca en texto plano). Por defecto arranca abierto hasta que el organizador configura un PIN; al configurarlo o recargar con PIN activo, queda bloqueado automáticamente: oculta `Simular resultados (Prueba)` y solicita PIN antes de eliminar torneos, corregir resultados administrativos o registrar sustituciones/retiros.
  2. **Llave Visual por Fases (`EliminationBracketView.tsx`):** Visible **exclusivamente en `qualifying_elimination`** (oculta en `rounds_all_play`), dentro de la pestaña `Llave` en torneo activo, en el toggle `Llave en vivo` de `ProjectionView` y en `CompletedTournamentScreen`. Muestra la Clasificatoria (R1–R2) con línea de corte en vivo (`Top 4 / Top 8 / Top 16`), cada fase eliminatoria y el podio final.
  3. **Pruebas E2E Playwright (`tests/e2e/tournament-phase5.spec.ts`):** Suite automatizada en navegador Chromium real para viewports desktop (`1280x800`) y móvil (`390x844`), levantando Vite automáticamente (`npm run test:e2e`).
  4. **Alcance diferido a Fase 6:** Generación y firma/prueba del instalador Windows `.exe` (NSIS) y manual rápido de 1 página.
