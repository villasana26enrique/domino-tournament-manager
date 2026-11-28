# Reporte de Pruebas y Auditoría (TEST_REPORT.md)

Este archivo conserva evidencia real y reproducible de cada comando de verificación ejecutado por fase. Nunca se documenta una prueba que no haya sido ejecutada y verificada en consola.

---

## PWA 100% Offline, Wake Lock Web, SEO/Open Graph y Limpieza (ADR-015 — TDD estricto)

- **Fecha de ejecución:** 2026-11-27
- **Rama / PR:** `feature/pwa-offline-seo` → `main`
- **Ciclo TDD (`tests/infrastructure/power-and-pwa.test.ts`):**
  - **Rojo:** Falló al importar `src/infrastructure/pwa-register.ts` antes de crear el módulo.
  - **Verde:** Tras implementar Screen Wake Lock web en `power-manager.ts` y registro seguro de Service Worker en `pwa-register.ts` (omitido en Tauri), pasaron **3/3 pruebas**.
- **Verificación completa tras la última edición de código y pruebas:**
  - `npm run typecheck`: **APROBADO** (`exit code 0`, `0` errores).
  - `npm test`: **19/19 archivos, 97/97 pruebas aprobadas** en `3.82s`.
  - `npm run build`: **APROBADO** (`vite build` en `1.62s` + `PWA v2.0.0` `generateSW`: `20` entradas precacheadas, `1672.25 KiB`, `dist/sw.js` y `dist/manifest.webmanifest`).
  - `npm run test:e2e`: **10/10 pruebas Playwright aprobadas** (`5.8s`, 5 en desktop `1280x800` + 5 en móvil `390x844`), validando HTTP 200 en manifest/SW/iconos/`og-card.png`/`robots.txt`/`sitemap.xml`, etiquetas SEO/JSON-LD y **recarga + creación de torneo con `context.setOffline(true)`**.
  - `npm run simulate:matrix -- --seeds 1,2`: **42 ejecuciones** (`0..41`) con **`Total de violaciones de restricciones: 0`**.

---

## Bilingüe `EN` (principal) + `ES` con autodetección (ADR-014 — TDD estricto)

- **Fecha de ejecución:** 2026-11-27
- **Rama / PR:** `feature/i18n-en-es` → `main`
- **Ciclos TDD (Rojo → Verde):**
  1. **Ciclo 1 — Core i18n, detección de idioma, reglamento y PDFs en inglés (`tests/i18n/i18n-and-localization.test.ts`):**
     - **Rojo:** Falló (`ERR_MODULE_NOT_FOUND` para `src/i18n/locale.js`) antes de implementar `src/i18n/`.
     - **Verde:** Tras implementar `CoreLocale`, `generateTournamentRules(..., 'en')`, `src/i18n/*` (`en.ts`, `es.ts`, `locale.ts`, `domain-labels.ts`, `context.tsx`) y `pdf-exporter.ts` bilingüe, pasaron **5/5 pruebas** (incluyendo paridad exacta de claves `en`/`es` y bytes `%PDF-` válidos).
  2. **Ciclo 2 — UI completa bilingüe y autodetección (`tests/ui/i18n-bilingual.test.tsx`):**
     - **Rojo:** Falló **2/2 pruebas** antes de cablear `I18nProvider`, el selector `EN | ES` y los diccionarios en pantallas y modales.
     - **Verde:** Tras actualizar `index.html`, `App.tsx`, todas las pantallas y componentes, pasaron **2/2 pruebas** nuevas y toda la suite previa (**18/18 archivos, 94/94 pruebas**).
- **Verificación completa tras la última edición de código y pruebas:**
  - `npm run typecheck`: **APROBADO** (`exit code 0`, `0` errores).
  - `npm test`: **18/18 archivos, 94/94 pruebas aprobadas** en `3.56s`.
  - `npm run build`: **APROBADO** (`tsc --noEmit && vite build`, `1.64s`).
  - `npm run test:e2e`: **8/8 pruebas Playwright aprobadas** (`5.4s`, 4 en desktop `1280x800` + 4 en móvil `390x844` cubriendo flujo completo en inglés, llave visual, PIN de organizador, cambio persistente `EN <-> ES` y autodetección `es-ES`).
  - `npm run simulate:matrix -- --seeds 1,2`: **42 ejecuciones** (`0..41`) con **`Total de violaciones de restricciones: 0`**.

---

## Fase 5 — PIN Local de Organizador, Llave Visual por Fases y Pruebas E2E Playwright (TDD estricto)

- **Fecha de ejecución:** 2026-11-27
- **Rama / PR:** `feature/phase-5-pin-bracket-e2e` → `main` (ADR-013)
- **Ciclos TDD (Rojo → Verde):**
  1. **Ciclo 1 — Store local de PIN (`src/infrastructure/organizer-pin.ts`):**
     - **Rojo:** `npm test -- tests/infrastructure/organizer-pin.test.ts` falló (`ERR_MODULE_NOT_FOUND`) antes de crear `organizer-pin.ts`.
     - **Verde:** Tras implementar `validatePinFormat` y `createOrganizerPinStore` (hash con sal, nunca PIN en texto plano), pasaron **3/3 pruebas**.
  2. **Ciclo 2 — UI PIN + Llave Visual (`OrganizerPinModal.tsx`, `EliminationBracketView.tsx`, `ProjectionView.tsx`, `ActiveTournamentScreen.tsx`, `CompletedTournamentScreen.tsx`, `App.tsx`):**
     - **Rojo:** `npm test -- tests/ui/phase5-pin-and-bracket.test.tsx` falló **2/2 pruebas** antes de implementar los componentes.
     - **Verde:** Tras implementar `EliminationBracketView` (solo para `qualifying_elimination`), `OrganizerPinModal`, la barra superior con bloqueo y las guardas de eliminación/corrección/retiro/sustitución, pasaron todas las pruebas de Vitest (`tests/ui/phase5-pin-and-bracket.test.tsx` **2/2**).
- **Verificación completa tras la última edición de código y pruebas:**
  - `npm run typecheck`: **APROBADO** (`exit code 0`, `0` errores).
  - `npm test`: **16/16 archivos, 87/87 pruebas aprobadas** en `3.41s`.
  - `npm run build`: **APROBADO** (`tsc --noEmit && vite build`, `1.51s`).
  - `npm run test:e2e` (Playwright Chromium sobre `dist/` servido en `127.0.0.1:1425` con `scripts/serve-dist.mjs`): **6/6 pruebas aprobadas** en `6.3s` (3 en viewport desktop `1280x800` + 3 en viewport móvil `390x844`, cubriendo `qualifying_elimination` + llave visual + proyección en vivo, `rounds_all_play` sin pestaña `Llave` + guardia de salida, y persistencia/bloqueo de PIN tras recarga).
  - `npm run simulate:matrix -- --seeds 1,2`: **42 ejecuciones** (`0..41`) con **`Total de violaciones de restricciones: 0`**.

---

## Ajuste Post-Fase 4 (ADR-012) — Descansos de Clasificatoria 2 para Ganadores de R1 (TDD estricto)

- **Fecha de ejecución:** 2026-11-27
- **Rama / PR:** `fix/adr-012-r2-winner-byes` → `main`
- **Ciclo TDD (Rojo → Verde):**
  - **Rojo:** `npm test -- tests/core/elimination-and-substitutes.test.ts tests/application/tournament-execution.test.ts` falló **4/13 pruebas** antes de implementar `selectQualifyingRound2Byes`: 3 pruebas nuevas en `Qualifying Round 2 Byes Favor R1 Winners (ADR-012)` y 1 aserción añadida en `executes full qualifying_elimination tournament` al confirmar que R2 asignaba descansos sin priorizar ganadores de R1.
  - **Verde:** Tras implementar `selectQualifyingRound2Byes` en `src/core/algorithms/elimination-planner.ts` e integrarlo en `tournament-simulator.ts`, `TournamentService.completeRoundAndAdvance`, `tournament-planner.ts` y `rule-generator.ts`:
    - `npm run typecheck`: **APROBADO** (`0` errores).
    - `npm test`: **14/14 archivos, 82/82 pruebas aprobadas** en `3.59s` (`tests/core/elimination-and-substitutes.test.ts` **8/8**; `tests/application/tournament-execution.test.ts` **5/5**; `tests/core/matchmaking-properties.test.ts` **26/26** incluyendo 60 ensayos de fuzzing).
    - `npm run build`: **APROBADO** (`tsc --noEmit && vite build` en `1.61s`).
    - `npm run simulate:matrix -- --seeds 1,2`: **42 ejecuciones** (`0..41`) con **0 violaciones de restricciones**.

---

## Fase 4 — Eliminar Torneo, PDF Offline, Modo Proyección, Respaldo JSON, Estadísticas y Responsive (TDD estricto)

- **Fecha de ejecución:** 2026-11-27
- **Entorno:** macOS, Node.js `v24.15.0`, npm `11.12.1`, TypeScript `5.8.2`, Vitest `3.2.7`, Vite `6.4.6`
- **Metodología:** **TDD estricto (Rojo → Verde → Refactor)** en los 3 ciclos de Fase 4.

### 1. Evidencia de ciclos TDD (Rojo → Verde)

1. **Ciclo 1 — Estadísticas, `deleteTournament` y Respaldo JSON (`computeTournamentStats`, `TournamentService`, `src-tauri/`):**
   - **Rojo:** `npm test -- tests/core/tournament-stats.test.ts tests/application/backup-and-delete.test.ts` falló **3/3 pruebas** antes de implementar las funciones.
   - **Verde:** Tras implementar `tournament-stats.ts`, `deleteTournament`, `exportBackupPayload`, `importBackupPayload` (validado con Zod), `delete_tournament` en Rust y `power/mod.rs` (`SetThreadExecutionState`), pasaron las **3 pruebas nuevas** y toda la suite previa de servicio (**9/9** en ese bloque).
2. **Ciclo 2 — Exportador PDF 100% offline (`src/infrastructure/pdf-exporter.ts`):**
   - **Rojo:** `npm test -- tests/infrastructure/pdf-exporter.test.ts` falló (`ERR_MODULE_NOT_FOUND`) antes de crear `pdf-exporter.ts`.
   - **Verde:** Tras implementar `generateRulesPdfBytes` y `generateFinalReportPdfBytes` con `jsPDF` + `jspdf-autotable`, pasaron **2/2 pruebas** verificando cabecera binaria real `%PDF-` y tamaño >1000 bytes.
3. **Ciclo 3 — UI Fase 4 (Eliminar con modal, BackupModal, ProjectionView, Estadísticas, PDF y Responsive móvil):**
   - **Rojo:** `npm test -- tests/ui/phase4-features.test.tsx` falló **4/4 pruebas** antes de crear los componentes.
   - **Verde:** Tras implementar `DeleteTournamentModal`, `BackupModal`, `ProjectionView` y actualizar `HomeScreen`, `PreviewScreen`, `ActiveTournamentScreen`, `CompletedTournamentScreen` y `App.tsx`, pasaron **4/4 pruebas** E2E en `jsdom`.

### 2. Verificación completa TypeScript, Suite Total, Build y Auditoría (`2026-11-27`)

- `npm run typecheck`: **APROBADO** (`exit code 0`, 0 errores).
- `npm test`: **14/14 archivos, 79/79 pruebas aprobadas** en `3.18s`:
  - `tests/core/round-timer.test.ts` (6/6)
  - `tests/core/tournament-stats.test.ts` (1/1)
  - `tests/core/validation-and-ranking.test.ts` (9/9)
  - `tests/core/round-planner-and-byes.test.ts` (7/7)
  - `tests/core/elimination-and-substitutes.test.ts` (5/5)
  - `tests/core/matchmaking-properties.test.ts` (26/26 — incluye 60 ensayos de fuzzing)
  - `tests/application/tournament-service.test.ts` (6/6)
  - `tests/application/tournament-execution.test.ts` (5/5)
  - `tests/application/backup-and-delete.test.ts` (2/2)
  - `tests/infrastructure/browser-local-repository.test.ts` (2/2)
  - `tests/infrastructure/pdf-exporter.test.ts` (2/2)
  - `tests/ui/tournament-flow.test.tsx` (2/2)
  - `tests/ui/tournament-execution-flow.test.tsx` (2/2)
  - `tests/ui/phase4-features.test.tsx` (4/4)
- `npm run build`: **APROBADO** (`tsc --noEmit && vite build` en `1.59s`).
- `npm run simulate:matrix -- --seeds 1,2`: **42/42 torneos** con **0 violaciones de restricciones** y **0 repeticiones de compañero**.

### 3. Estado honesto de pruebas Rust / SQLite (`src-tauri/`)

- **Pendiente de ejecución local:** `rustc` / `cargo` no están instalados en esta Mac, por lo que `cargo test` (que incluye `delete_tournament` y `power::set_keep_awake`) no ha corrido en local todavía; se ejecuta en CI `windows-latest` o al instalar `rustup`.

---

## Pendiente en Fase 6

- Build del instalador NSIS `.exe` en Windows (CI / máquina Windows), prueba real en PC Windows limpia *(no se declarará funcional hasta probarse en Windows)* y manual rápido de 1 página para organizadores.
