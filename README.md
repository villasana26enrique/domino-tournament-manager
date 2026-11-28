# Domino Tournament Manager

Gestor de torneos de dominó **offline-first** (Web PWA instalable + shell de escritorio Windows Tauri v2) en modalidad **Individual con parejas rotativas**, bilingüe (**EN | ES**), justo, determinista y auditado.

- **Aplicación web / PWA en vivo:** https://villasana26enrique.github.io/domino-tournament-manager/
- **Guía rápida de uso (1 página):** [MANUAL_ORGANIZADOR.md](MANUAL_ORGANIZADOR.md)
- **Indexación en Google:** [docs/GOOGLE_INDEXING.md](docs/GOOGLE_INDEXING.md)
- **Licenciamiento Pro offline (actualmente pausado):** [LICENSING.md](LICENSING.md)

---

## Características principales

- **Dos formatos oficiales sin mesas cojas:**
  - **Por rondas (todos juegan igual):** para múltiplos exactos de 4 (`8, 12, 16, 20, 24…`), con **0 descansos** y máximo balance de compañeros/rivales.
  - **Clasificatoria + Eliminaciones hasta Gran Final:** para cualquier $N \ge 4$ jugadores, con 2 rondas clasificatorias (descansos de R1 con pase libre a R2 y descansos de R2 priorizando ganadores de R1), cortes a múltiplo exacto de 4 (`16 → 8 → 4`) y **Llave visual interactiva** en torneo activo, Modo Proyección TV y resumen final.
- **Operación real de torneo:**
  - Cronómetro persistente de ronda (`25 min`, aviso a los `2 min`, alarma Web Audio + Wake Lock para evitar suspensión de pantalla).
  - Regla exacta de cierre por tiempo sin muerte súbita, puntajes reales sin recorte (`> 100`), bitácora de correcciones administrativas y sustituto / retiro en vivo.
  - **Modo Proyección TV** en pantalla completa, **PIN local de organizador** (hash con sal, sin cuentas ni servidores) y respaldo/restauración `.json`.
- **Reportes y compartición:**
  - Generación offline de **Reglamento Oficial PDF**, **Reporte Final PDF** (`jspdf` + `autotable`) y **Tarjeta PNG resumen del campeón (`1080×1350`)** lista para WhatsApp.
- **100% bilingüe (`EN | ES`):**
  - Inglés principal para descubrimiento web internacional, autodetección de navegador en español (`es*`) y selector instantáneo `EN | ES`.
- **Monetización Pro desacoplada por feature flag:**
  - Implementación completa con firmas asimétricas **Ed25519** offline + branding local de club + generador CLI (`npm run license:issue`), actualmente pausada mediante `PRO_MONETIZATION_ENABLED = false` en [src/infrastructure/commercial-config.ts](src/infrastructure/commercial-config.ts) para ofrecer la app 100% abierta sin límite de jugadores.

---

## Arquitectura del repositorio

- `src/core/`: Motor de competición puro en TypeScript estricto (sin dependencias React/Node/Tauri): validaciones Zod, PRNG determinista (`xoshiro128**` + `splitmix32`), planificador de rondas, emparejador multi-start, calculadora de ranking, generador de reglamentos y simulador headless (`src/cli/simulate.ts`).
- `src/application/`: `TournamentService`, casos de uso transaccionales, respaldo JSON y puerto de persistencia.
- `src/infrastructure/`: Repositorio local en navegador (`localStorage`), SQLite Tauri (`src-tauri/`), exportadores PDF y tarjeta PNG, audio/Wake Lock, registro PWA, PIN local y almacén de licencias Ed25519.
- `src/i18n/`: Diccionarios tipados `en.ts` y `es.ts` con paridad estructural verificada en pruebas.
- `src/ui/`: Pantallas y componentes React 19 + Tailwind CSS v4.
- `src-tauri/`: Backend Rust + SQLite (`rusqlite` en modo WAL) + instalador Windows `NSIS`.

---

## Comandos principales

```bash
# Instalar dependencias
npm install

# Desarrollo web local (http://127.0.0.1:1420)
npm run dev

# Verificación estricta de tipos y suite completa (unitarias, propiedades, UI)
npm run typecheck
npm test

# Build de producción + Service Worker PWA (dist/)
npm run build

# Pruebas E2E Playwright (desktop 1280x800 + móvil 390x844; requiere build previo)
npm run test:e2e

# Auditoría matemática del motor (42 torneos, 0 violaciones esperadas)
npm run simulate:matrix -- --seeds 1,2,3

# Build del instalador Windows .exe (NSIS) — ejecutar en Windows con Rust instalado
npm run tauri:build
```

Para generar el instalador `.exe` de Windows sin compilar localmente en Windows, el repositorio incluye el workflow manual y por tags (`v*`) en [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml).

---

## Documentación técnica y trazabilidad

- [DECISIONS.md](DECISIONS.md): Registro de decisiones arquitectónicas y de negocio (`ADR-001` a `ADR-017`).
- [TEST_REPORT.md](TEST_REPORT.md): Evidencia verificada de pruebas por fase y PR.
- [MANUAL_ORGANIZADOR.md](MANUAL_ORGANIZADOR.md): Guía rápida imprimible de 1 página para organizadores.
- [docs/GOOGLE_INDEXING.md](docs/GOOGLE_INDEXING.md): Pasos para dar de alta en Google Search Console.
- [LICENSING.md](LICENSING.md): Guía de llaves Ed25519 offline para el modo Pro opcional.
