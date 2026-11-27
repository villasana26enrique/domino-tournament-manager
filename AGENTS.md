# AGENTS.md — Guía de Arquitectura, Reglas y Trabajo del Repositorio

Este documento describe la arquitectura, convenciones de código, reglas de negocio, flujo **TDD estricto** y comandos de verificación de **Domino Tournament Manager** para desarrolladores y revisores técnicos.

---

## 1. Visión del producto

**Domino Tournament Manager** es una aplicación de escritorio **offline-first** (plataforma principal Windows 10/11) para organizar torneos cortos de dominó social en modalidad **Individual con parejas rotativas** (4 jugadores reales por mesa, 2 contra 2), de forma automática, justa y explicable.

---

## 2. Reglas de negocio vigentes (resumen de `DECISIONS.md`)

1. **Dos modalidades disponibles al crear un torneo (`ADR-008`):**
   - **Por rondas (`rounds_all_play`):** Disponible **solo cuando $N$ es múltiplo de 4** ($4, 8, 12, 16, 20, 24, \dots$). Todos juegan las mismas rondas con **0 descansos** y 0 eliminaciones.
   - **Clasificatoria con eliminaciones hasta la Final (`qualifying_elimination`):** Disponible para **cualquier $N \ge 4$** (obligatoria si $N \bmod 4 \ne 0$).
     - 2 rondas clasificatorias (en R1 los $N \bmod 4$ elegidos al azar tienen pase libre a R2 y juegan obligatoriamente en R2; rotar parejas en R2 evita dividir al azar parejas empatadas al hacer cortes impares).
     - Fases eliminatorias en múltiplos exactos de 4 con **0 descansos**: `Cuartos (16) → Semifinal (8) → Gran Final (4)` (o `Semifinal (8) → Gran Final (4)` para $8 \le N \le 15$; directo `Gran Final (4)` para $4 \le N \le 7$). Avanzan las parejas ganadoras de cada mesa.
     - **Gran Final de 1 sola partida:** Se proclama la **Pareja Ganadora de la Final** y, entre sus 2 integrantes, el **Campeón Individual** según rendimiento acumulado del torneo.
2. **Puntuación y tiempo (`ADR-002`, `ADR-007`):**
   - Objetivo predeterminado: 100 puntos (configurable 50–300). Se registran los puntos reales completos sin recorte (ej. `133-84`).
   - Duración predeterminada: 25 min por ronda con aviso a los 5 min y alarma al final.
   - Al agotarse el tiempo, cada mesa culmina únicamente la mano en curso y anota los puntos tal como quedaron: **si quedan empatados, la partida queda empatada (`draw`), sin muerte súbita ni ganador ni perdedor**.
   - Validaciones duras: se rechazan puntajes negativos, decimales, empates en cierre por objetivo (`endedBy = 'target_score'`) y que ambas parejas alcancen $\ge$ objetivo (físicamente imposible en dominó).
3. **Clasificación (`ADR-003`):**
   - Victoria = `1.0` punto de partida (`matchPoints`), Empate por tiempo = `0.5`, Derrota = `0.0`.
   - En `equal_games`: `Puntos de partida` → `Victorias` → `Diferencia (PF-PC)` → `Puntos a favor` → `Enfrentamiento directo`.
   - En `unequal_games`: `% efectividad ((V + 0.5·E) / PJ)` → `Puntos de partida` → `Victorias` → `Diferencia promedio` → `Puntos promedio a favor` → `Menos derrotas` → `Enfrentamiento directo`.
   - La tabla siempre se recalcula desde cero a partir de los resultados confirmados.
4. **Inmutabilidad y contingencias (`ADR-006`):**
   - Al iniciar un torneo se guarda una instantánea inmutable del reglamento (`TournamentRuleSnapshot`).
   - Las rondas completadas nunca se alteran al regenerar cruces futuros ni ante retiros.
   - Si un jugador abandona a mitad de un torneo *Por rondas*, el organizador puede **asignar un sustituto** (mantiene múltiplo de 4 y 0 descansos) o registrar **retiro sin sustituto** (recalcula únicamente rondas futuras).

Para el historial completo de decisiones arquitectónicas, consulta [DECISIONS.md](./DECISIONS.md).

---

## 3. Arquitectura por capas y reglas de dependencias

```text
UI (React + Tailwind)  ──▶  Application (Casos de uso + Puertos)  ──▶  Core (Dominio + Algoritmos)
                                        │
                                        ▼
                            Infrastructure (Adaptadores)
                            ├── InMemoryTournamentRepository (tests)
                            ├── BrowserLocalRepository (preview web dev)
                            └── TauriSqliteRepository ──▶ src-tauri (Rust + rusqlite WAL)
```

### Reglas estrictas de frontera
1. **`src/core/` es 100% TypeScript puro:**
   - PROHIBIDO importar `react`, `@tauri-apps/*`, `zustand`, `localStorage` o SQLite.
   - PROHIBIDO usar `Math.random()`. Toda aleatoriedad debe pasar por `SeededRng` (`src/core/prng/seeded-rng.ts`).
2. **`src/application/` orquesta casos de uso:**
   - Depende únicamente de `src/core/` y de interfaces (`ports/`) como `TournamentRepository` y `IdGenerator`.
   - Toda validación de flujo de negocio (ej. no iniciar un torneo con menos de 4 jugadores, no modificar participantes tras iniciar) vive aquí y se cubre con pruebas unitarias.
3. **`src/infrastructure/` implementa puertos:**
   - En desktop (Tauri), `TauriSqliteRepository` delega operaciones críticas a comandos atómicos en Rust (`src-tauri/`).
   - En pruebas unitarias e integración TS, se usa `InMemoryTournamentRepository`.
   - En vista previa web (`npm run dev` fuera de Tauri), un adaptador local persistente (`BrowserLocalRepository`) permite probar la UI en el navegador sin romper la detección automática del runtime.
4. **`src/ui/` solo presenta y despacha casos de uso:**
   - Sin lógica matemática de emparejamientos ni cálculos de clasificación dentro de componentes React.
5. **`src-tauri/` (Rust + SQLite):**
   - Persistencia en `rusqlite` con `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;`.
   - Migraciones SQL idempotentes (`src-tauri/migrations/001_initial.sql`).
   - Transacciones ACID explícitas (`BEGIN IMMEDIATE ... COMMIT`) en Rust para escrituras multi-tabla.

---

## 4. Estructura del repositorio

```text
domino-tournament-manager/
├── AGENTS.md                           # Este documento (arquitectura, TDD, convenciones)
├── DECISIONS.md                        # ADRs de producto y arquitectura
├── TEST_REPORT.md                      # Evidencia real ejecutada por fase
├── README.md                           # Guía rápida de instalación y uso
├── package.json                        # Scripts de build, test, auditoría y Tauri
├── tsconfig.json                       # TypeScript estricto
├── vitest.config.ts                    # Runner de pruebas TS
├── vite.config.ts                      # Bundler React + Tailwind (Fase 2+)
├── src/
│   ├── core/                           # Dominio puro, PRNG, algoritmos, reglas, simulador
│   ├── cli/                            # CLI headless de auditoría JSON (`simulate.ts`)
│   ├── application/                    # Puertos (Repository) y casos de uso
│   ├── infrastructure/                 # Adaptadores (InMemory, BrowserLocal, TauriSqlite)
│   └── ui/                             # Pantallas y componentes React + Tailwind
├── src-tauri/                          # Backend desktop Rust + SQLite + migraciones + tests
└── tests/
    ├── core/                           # Pruebas unitarias, propiedades y fuzzing del motor
    ├── application/                    # Pruebas TDD de casos de uso y flujos
    └── ui/                             # Pruebas de lógica de presentación / componentes
```

---

## 5. Flujo obligatorio: TDD estricto (Rojo → Verde → Refactor)

A partir de la Fase 2, toda funcionalidad nueva en `application/`, `infrastructure/`, `src-tauri/` y lógica de `ui/` sigue estrictamente:

1. **Rojo (Red):** Escribir primero la prueba que especifica el comportamiento esperado y ejecutar `npm test` (o `cargo test`) confirmando que falla por la razón correcta.
2. **Verde (Green):** Escribir la implementación mínima, limpia y tipada para hacer pasar la prueba.
3. **Refactor:** Mejorar nombres, extraer utilidades y eliminar duplicación manteniendo todas las pruebas en verde.

### Reglas de calidad y honestidad técnica
- TypeScript estricto (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
- Cero `any`, cero supresiones de tipos sin justificación explícita.
- Nunca afirmar que una prueba pasó sin haberla ejecutado.
- Nunca afirmar que el instalador `.exe` de Windows funciona hasta probarlo en una máquina/VM Windows real.
- Mantener `DECISIONS.md` y `TEST_REPORT.md` actualizados al cerrar cada fase.

---

## 6. Comandos de desarrollo, pruebas y auditoría

```bash
# Verificación estricta de tipos
npm run typecheck

# Ejecutar todas las pruebas TypeScript (core + application + ui)
npm test

# Ejecutar pruebas E2E en navegador real (Playwright Desktop + Móvil, requiere dist/ compilado)
npm run build && npm run test:e2e

# Modo TDD interactivo (watch)
npm run test:watch

# Auditoría headless del motor (sin levantar UI)
npm run simulate -- --players 25 --format qualifying_elimination --seed 42 --out reports/sim-25.json
npm run simulate:matrix -- --seeds 1,2,3
npm run simulate:verify-determinism -- --players 25 --format qualifying_elimination --seed 999

# Levantar interfaz web de desarrollo (Vite)
npm run dev

# Levantar aplicación desktop nativa (requiere Rust / Cargo)
npm run tauri:dev

# Pruebas de persistencia SQLite en Rust (requiere Rust / Cargo)
cargo test --manifest-path src-tauri/Cargo.toml
```
