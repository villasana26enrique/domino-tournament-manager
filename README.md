# Domino Tournament Manager

Aplicación de escritorio **offline-first** para Windows 10/11 (en construcción por fases) diseñada para organizar torneos sociales cortos de dominó en modalidad **Individual con parejas rotativas**, de forma automática, justa y explicable.

## Estado actual

- **Fase 0 y Fase 1 completadas (v1.1):** Motor de competición puro en TypeScript estricto (`src/core/`) con las dos modalidades aprobadas (**Por rondas** solo para múltiplos de 4 con 0 descansos, y **Clasificatoria con eliminaciones hasta Gran Final de 1 partida** para cualquier $N \ge 4$), soporte para sustitutos y retiros administrativos, generador de reglamentos, simulador determinista headless con exportación JSON (`src/cli/simulate.ts`) y 47 pruebas automatizadas (unitarias, propiedades e invariantes).
- **Próxima fase (Fase 2):** Shell desktop Tauri v2, persistencia SQLite transaccional en Rust (`rusqlite` WAL) y pantallas de creación, registro y previsualización.

## Requisitos previos

- Node.js 20+ (probado en Node 24)
- npm 10+

## Instalación

```bash
npm install
```

## Comandos de auditoría y pruebas (headless, sin UI)

```bash
# Verificación de tipos estricta (TypeScript)
npm run typecheck

# Suite completa de pruebas unitarias, propiedades e invariantes
npm test

# Simular un torneo concreto y exportar calendario, métricas y ranking a JSON
npm run simulate -- --players 15 --rounds auto --seed 42 --mode hybrid_competitive --out reports/sim-15-seed42.json

# Simular matriz estándar de auditoría (4,5,6,7,8,10,12,15,16,20,24,25,30,40)
npm run simulate:matrix -- --seeds 1,2,3,4,5 --out reports/matrix-audit.json

# Verificar determinismo byte-a-byte con semilla fija
npm run simulate:verify-determinism -- --players 25 --seed 999

# Ejecutar auditoría completa (typecheck + tests + matrix)
npm run audit
```

## Estructura del proyecto

- `src/core/domain/`: Entidades, tipos, errores y validaciones Zod (incluyendo reglas físicas de dominó).
- `src/core/prng/`: PRNG determinista con semilla (`xoshiro128**` + `splitmix32`).
- `src/core/algorithms/`: Planificador de rondas, rotación modular de descansos, motor de emparejamiento por búsqueda local multi-start, evaluador de equidad, validador independiente de restricciones y calculadora de clasificación.
- `src/core/rules/`: Generador de reglamentos estructurados y texto oficial consistente con los parámetros efectivos.
- `src/core/simulation/`: Simulador determinista de torneos completos para auditoría externa.
- `src/cli/`: Interfaz de línea de comandos para simulaciones y exportación JSON.
- `tests/core/`: Pruebas unitarias, de propiedades e invariantes.
- `DECISIONS.md`: Registro de decisiones arquitectónicas y de negocio (ADR).
- `TEST_REPORT.md`: Evidencia de pruebas ejecutadas en cada fase.
