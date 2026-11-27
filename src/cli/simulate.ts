import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_TOURNAMENT_CONFIG,
  simulateTournament,
  type RoundPlanningMode,
  type SchedulingMode,
  type SimulationReport,
  type TournamentFormat
} from '../core/index.js';

const STANDARD_MATRIX_SIZES = [4, 5, 6, 7, 8, 10, 12, 15, 16, 20, 24, 25, 30, 40];

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function writeJsonReport(outPath: string, data: unknown): void {
  const fullPath = resolve(outPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`JSON exportado en: ${fullPath}`);
}

function resolveFormatArg(formatArg: string | undefined, players: number): TournamentFormat {
  if (!formatArg || formatArg === 'auto') {
    return players % 4 === 0 ? 'rounds_all_play' : 'qualifying_elimination';
  }
  return formatArg as TournamentFormat;
}

function printSingleSummary(report: SimulationReport): void {
  console.log('=== Resumen de Simulación ===');
  console.log(`Formato: ${report.format} | Participantes: ${report.participantCount} | Rondas: ${report.plannedRounds}`);
  console.log(`Mesas iniciales: ${report.tablesPerRound} | Descansos R1: ${report.byesPerRound} | Modo ranking: ${report.rankingMode}`);
  console.log(`Semilla: ${report.seed} | Modo cruces: ${report.config.schedulingMode}`);
  if (report.stages) {
    console.log(
      `Fases: ${report.stages.map((s) => `${s.stageName} (${s.expectedParticipants})`).join(' -> ')}`
    );
  }
  console.log(`Repeticiones de compañero (exceso): ${report.summary.repeatedPartners.totalExcessRepeats} (máx veces juntos: ${report.summary.repeatedPartners.maxPairCount})`);
  console.log(`Repeticiones de rival (exceso): ${report.summary.repeatedOpponents.totalExcessRepeats} (máx veces rivales: ${report.summary.repeatedOpponents.maxOpponentCount})`);
  console.log(`Descansos consecutivos: ${report.summary.consecutiveByesCount} | Violaciones: ${report.constraintViolations.length}`);

  if (report.finalChampion) {
    const { individualChampion, winningPair, finalMatch } = report.finalChampion;
    console.log(
      `Gran Final (${finalMatch.pairAScore}-${finalMatch.pairBScore}): Pareja Ganadora [${winningPair[0].displayName} & ${winningPair[1].displayName}]`
    );
    console.log(
      `Campeón Individual: ${individualChampion.displayName} (${individualChampion.wins}V-${individualChampion.draws}E-${individualChampion.losses}D, dif ${individualChampion.pointDiff >= 0 ? '+' : ''}${individualChampion.pointDiff})`
    );
  } else if (report.finalStandings[0]) {
    const champion = report.finalStandings[0];
    console.log(
      `Campeón: ${champion.displayName} (${champion.wins}V-${champion.draws}E-${champion.losses}D, ${(champion.winRate * 100).toFixed(1)}%, dif ${champion.pointDiff >= 0 ? '+' : ''}${champion.pointDiff})`
    );
  }
  console.log(`Tiempo ejecución: ${report.executionTimeMs} ms`);
}

function runSingle(args: Record<string, string>): void {
  const players = Number(args.players ?? '25');
  const seed = args.seed ?? 'seed-42';
  const format = resolveFormatArg(args.format, players);
  const mode = (args.mode ?? DEFAULT_TOURNAMENT_CONFIG.schedulingMode) as SchedulingMode;
  const planningMode = (args.planning ?? DEFAULT_TOURNAMENT_CONFIG.roundPlanningMode) as RoundPlanningMode;
  const maxTables = args.maxTables ? Number(args.maxTables) : null;
  const overrideRounds =
    args.rounds && args.rounds !== 'auto' ? Number(args.rounds) : undefined;

  const report = simulateTournament({
    participantCount: players,
    seed,
    config: {
      format,
      schedulingMode: mode,
      roundPlanningMode: planningMode,
      maxPhysicalTables: maxTables
    },
    ...(overrideRounds !== undefined ? { overrideRounds } : {})
  });

  printSingleSummary(report);
  if (args.out) {
    writeJsonReport(args.out, report);
  }
  if (report.constraintViolations.length > 0) {
    console.error('VIOLACIONES DETECTADAS:', JSON.stringify(report.constraintViolations, null, 2));
    process.exitCode = 1;
  }
}

function runMatrix(args: Record<string, string>): void {
  const sizes = args.sizes
    ? args.sizes.split(',').map((s) => Number(s.trim()))
    : STANDARD_MATRIX_SIZES;
  const seeds = args.seeds
    ? args.seeds.split(',').map((s) => s.trim())
    : ['audit-1', 'audit-2', 'audit-3'];
  const mode = (args.mode ?? 'hybrid_competitive') as SchedulingMode;

  const rows: Array<{
    players: number;
    format: TournamentFormat;
    seed: string;
    rounds: number;
    tablesR1: number;
    byesR1: number;
    partnerRepeats: number;
    opponentRepeats: number;
    consecutiveByes: number;
    violations: number;
    timeMs: number;
  }> = [];

  let totalViolations = 0;

  for (const players of sizes) {
    const formatsToRun: TournamentFormat[] =
      args.format && args.format !== 'auto'
        ? [args.format as TournamentFormat]
        : players % 4 === 0
          ? ['rounds_all_play', 'qualifying_elimination']
          : ['qualifying_elimination'];

    for (const format of formatsToRun) {
      for (const seed of seeds) {
        const report = simulateTournament({
          participantCount: players,
          seed,
          config: { format, schedulingMode: mode }
        });

        totalViolations += report.constraintViolations.length;
        rows.push({
          players,
          format,
          seed,
          rounds: report.plannedRounds,
          tablesR1: report.tablesPerRound,
          byesR1: report.byesPerRound,
          partnerRepeats: report.summary.repeatedPartners.totalExcessRepeats,
          opponentRepeats: report.summary.repeatedOpponents.totalExcessRepeats,
          consecutiveByes: report.summary.consecutiveByesCount,
          violations: report.constraintViolations.length,
          timeMs: report.executionTimeMs
        });
      }
    }
  }

  console.log(`=== Auditoría de Matriz (${rows.length} torneos simulados, modo: ${mode}) ===`);
  console.table(rows);
  console.log(`Total de violaciones de restricciones: ${totalViolations}`);

  if (args.out) {
    writeJsonReport(args.out, {
      generatedAt: new Date().toISOString(),
      mode,
      totalRuns: rows.length,
      totalViolations,
      runs: rows
    });
  }

  if (totalViolations > 0) {
    process.exitCode = 1;
  }
}

function runVerifyDeterminism(args: Record<string, string>): void {
  const players = Number(args.players ?? '25');
  const seed = args.seed ?? 'determinism-check-999';
  const format = resolveFormatArg(args.format, players);
  const mode = (args.mode ?? 'hybrid_competitive') as SchedulingMode;

  const r1 = simulateTournament({
    participantCount: players,
    seed,
    config: { format, schedulingMode: mode }
  });
  const r2 = simulateTournament({
    participantCount: players,
    seed,
    config: { format, schedulingMode: mode }
  });

  const normalized1 = JSON.stringify({ ...r1, executionTimeMs: 0 });
  const normalized2 = JSON.stringify({ ...r2, executionTimeMs: 0 });

  if (normalized1 !== normalized2) {
    console.error('FALLO DE DETERMINISMO: Dos ejecuciones con la misma semilla difieren.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `OK — Determinismo verificado byte-a-byte para N=${players}, format=${format}, seed="${seed}" (${r1.plannedRounds} rondas, 0 diferencias).`
  );
}

const [, , command = 'single', ...rest] = process.argv;
const parsed = parseArgs(rest);

switch (command) {
  case 'single':
    runSingle(parsed);
    break;
  case 'matrix':
    runMatrix(parsed);
    break;
  case 'verify-determinism':
    runVerifyDeterminism(parsed);
    break;
  default:
    console.error(`Comando desconocido: ${command}. Usa: single | matrix | verify-determinism`);
    process.exitCode = 1;
}
