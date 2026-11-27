import type {
  CoreLocale,
  EliminationStagePlan,
  RoundPlanRecommendation,
  StructuredRuleSection,
  StructuredRulesDocument,
  TournamentConfig
} from '../domain/types.js';

function localizeStageNameCore(stageName: string, locale: CoreLocale): string {
  if (locale === 'es') return stageName;
  if (stageName === 'Clasificatoria 1') return 'Qualifying Round 1';
  if (stageName === 'Clasificatoria 2 (Corte)') return 'Qualifying Round 2 (Cut)';
  if (stageName === 'Cuartos de Final') return 'Quarterfinals';
  if (stageName === 'Semifinal') return 'Semifinals';
  if (stageName === 'Gran Final') return 'Grand Final';
  const roundMatch = /^Ronda (\d+)$/.exec(stageName);
  if (roundMatch) return `Round ${roundMatch[1]}`;
  const topMatch = /^Eliminatoria Top (\d+)$/.exec(stageName);
  if (topMatch) return `Knockout Top ${topMatch[1]}`;
  return stageName;
}

export function generateTournamentRules(
  plan: RoundPlanRecommendation,
  config: TournamentConfig,
  eliminationStages: readonly EliminationStagePlan[] | null = null,
  locale: CoreLocale = 'es'
): StructuredRulesDocument {
  const { math } = plan;
  const roundDurationMinutes = Math.round(config.roundDurationSeconds / 60);
  const warningMinutesBeforeEnd = Math.round(config.warningBeforeEndSeconds / 60);
  const isElimination = config.format === 'qualifying_elimination' && eliminationStages !== null;

  if (locale === 'en') {
    const tablesLabel =
      math.tablesPerRound === 1
        ? '1 simultaneous table'
        : `${math.tablesPerRound} simultaneous tables`;

    const modalityTitle = isElimination
      ? 'Individual Rotating Pairs — Qualifying + Knockouts to the Final'
      : 'Individual Rotating Pairs — Fixed Rounds (Everyone Plays All Rounds)';

    const byeSummary = isElimination
      ? math.byesPerRound === 0
        ? 'There are zero byes in every stage: all tables are exact from Qualifying Round 1 through the Grand Final.'
        : `In Qualifying Round 1, ${math.byesPerRound} randomly selected ${
            math.byesPerRound === 1 ? 'player receives' : 'players receive'
          } a free pass to Qualifying Round 2; in Qualifying Round 2 they play obligatorily, and Round 2 ${
            math.byesPerRound === 1 ? 'bye is assigned' : `${math.byesPerRound} byes are assigned`
          } preferentially to Qualifying Round 1 winners so no Round 1 loser misses their second game. All knockout rounds are exact multiples of 4 with 0 byes.`
      : math.byesPerRound === 0
        ? 'Zero byes: because the roster is a multiple of 4, every player plays the exact same number of rounds.'
        : `${math.byesPerRound} players rotate fair byes each round due to the physical table cap.`;

    const stageSummary = isElimination
      ? eliminationStages
          .map(
            (s) =>
              `${localizeStageNameCore(s.stageName, 'en')} (${s.expectedParticipants}p, ${s.tablesCount} ${
                s.tablesCount === 1 ? 'table' : 'tables'
              })`
          )
          .join(' -> ')
      : '';

    const summary = isElimination
      ? `This tournament has ${math.participantCount} participants in ${modalityTitle}. ${plan.selectedRounds} rounds of ${roundDurationMinutes} minutes will be played (estimated total duration: ${plan.estimatedDurationMinutes} minutes): ${stageSummary}. ${byeSummary}`
      : `This tournament has ${math.participantCount} participants in ${modalityTitle}. ${tablesLabel} will run across ${plan.selectedRounds} rounds of ${roundDurationMinutes} minutes (estimated total duration: ${plan.estimatedDurationMinutes} minutes). ${byeSummary}`;

    const rankingItems = isElimination
      ? [
          'Qualifying cut (after Qualifying Round 2): top players advance by win rate ((Wins + 0.5 x Draws) / Games Played), match points, total wins, average point differential, and average points for.',
          'Knockout rounds (Quarterfinals / Semifinals): the winning pair at each table advances. In the rare case of a tie at time expiration, the pair with the higher prior cumulative ranking advances.',
          'Grand Final (1 single match of 4 finalists): the winning pair wins the Final, and the member of that pair with the stronger cumulative tournament record is crowned Individual Champion (their partner finishes Runner-up).'
        ]
      : [
          'Criterion 1: Match points (Win = 1, Time draw = 0.5, Loss = 0).',
          'Criterion 2: Most total wins.',
          'Criterion 3: Highest total point differential (Points For minus Points Against).',
          'Criterion 4: Most total points scored (Points For).',
          'Criterion 5: Head-to-head results as opponents (if played).',
          config.finalTieBreaker === 'playoff_match'
            ? 'Final tie-breaker at the top: if an exact tie persists, a short playoff match decides first place.'
            : 'Final tie-breaker at the top: if an exact tie persists, a shared championship is declared.'
        ];

    const schedulingItem = isElimination
      ? 'Per-stage pairing: partners rotate every round prioritizing first-time partners and competitively balanced tables (1st+4th vs 2nd+3rd).'
      : config.schedulingMode === 'hybrid_competitive'
        ? 'Hybrid pairing: each round is generated dynamically prioritizing new partners, opponent variety, and competitive balance in later rounds.'
        : 'Pre-built fixed schedule: all tables are generated before Round 1 prioritizing maximum partner and opponent variety.';

    const sections: StructuredRuleSection[] = [
      {
        id: 'format',
        title: '1. Format & Structure',
        items: isElimination
          ? [
              `Format: ${modalityTitle} (4 real players per table, 2 vs 2).`,
              `Scheduled stages: ${stageSummary}.`,
              schedulingItem
            ]
          : [
              `Format: ${modalityTitle} (4 real players per table, 2 vs 2).`,
              'No eliminations: every registered player competes through all scheduled rounds.',
              `Participants: ${math.participantCount}. Simultaneous tables: ${math.tablesPerRound}. Scheduled rounds: ${plan.selectedRounds}.`,
              schedulingItem
            ]
      },
      {
        id: 'scoring_and_time',
        title: '2. Round Timer & Scoring',
        items: [
          `Each match targets ${config.targetScore} points. Once a pair reaches or exceeds ${config.targetScore} points, their match ends immediately.`,
          `Full actual points scored by both pairs are recorded without capping at ${config.targetScore}.`,
          `Maximum round time: ${roundDurationMinutes} minutes, with an audiovisual warning ${warningMinutesBeforeEnd} minutes before the end and a final alarm on expiration.`,
          'When time expires, tables currently playing finish only the hand in progress and do not deal a new hand.',
          'Once that hand finishes, exact final scores are recorded: the higher score wins, and if tied in points, the match is officially recorded as a draw (no sudden death, no winner or loser).'
        ]
      },
      {
        id: 'byes_and_withdrawals',
        title: '3. Byes, Substitutes & Withdrawals',
        items: [
          byeSummary,
          'Ghost players or incomplete tables are never simulated.',
          'If a player must withdraw mid-tournament, the organizer can assign a substitute (preserving exact tables with zero byes) or record an administrative withdrawal recalculating future rounds only without altering past results.'
        ]
      },
      {
        id: 'ranking',
        title: '4. Standings & Champion Criteria',
        items: rankingItems
      },
      {
        id: 'integrity',
        title: '5. Integrity & Corrections',
        items: [
          'Match results are recorded by pair and credited individually to both members of the pair.',
          'Standings are always recomputed from scratch from confirmed match records.',
          'Any administrative score correction is recorded permanently in the tournament audit log.'
        ]
      }
    ];

    const mdLines: string[] = ['# Official Domino Tournament Rules', '', summary, ''];
    for (const section of sections) {
      mdLines.push(`## ${section.title}`, '');
      for (const item of section.items) {
        mdLines.push(`- ${item}`);
      }
      mdLines.push('');
    }

    return {
      version: '1.1.0',
      modality: 'individual_rotating_pairs',
      format: config.format,
      modalityTitle,
      summary,
      parameters: {
        format: config.format,
        participantCount: math.participantCount,
        tablesPerRound: math.tablesPerRound,
        byesPerRound: math.byesPerRound,
        plannedRounds: plan.selectedRounds,
        roundDurationMinutes,
        warningMinutesBeforeEnd,
        targetScore: config.targetScore,
        estimatedDurationMinutes: plan.estimatedDurationMinutes,
        equalGamesAchieved: plan.equalGamesAchieved,
        minGamesPerPlayer: plan.minGamesPerPlayer,
        maxGamesPerPlayer: plan.maxGamesPerPlayer,
        rankingMode: plan.rankingMode,
        schedulingMode: config.schedulingMode,
        tieResolutionRule: config.tieResolutionRule,
        finalTieBreaker: config.finalTieBreaker
      },
      sections,
      renderedMarkdown: mdLines.join('\n').trim()
    };
  }

  const tablesLabel =
    math.tablesPerRound === 1 ? '1 mesa simultánea' : `${math.tablesPerRound} mesas simultáneas`;

  const modalityTitle = isElimination
    ? 'Individual con parejas rotativas — Clasificatoria con eliminaciones hasta la Final'
    : 'Individual con parejas rotativas — Por rondas (todos juegan hasta el final)';

  const byeSummary = isElimination
    ? math.byesPerRound === 0
      ? 'No habrá descansos en ninguna fase: todas las mesas son exactas desde la Clasificatoria 1 hasta la Gran Final.'
      : `En la Clasificatoria 1 descansarán ${math.byesPerRound} ${
          math.byesPerRound === 1 ? 'jugador elegido' : 'jugadores elegidos'
        } al azar con pase libre a la Clasificatoria 2; en la Clasificatoria 2 juegan obligatoriamente y ${
          math.byesPerRound === 1 ? 'el descanso se asigna' : `los ${math.byesPerRound} descansos se asignan`
        } prioritariamente a ganadores de la Clasificatoria 1 para que ningún perdedor de Ronda 1 pierda su segunda oportunidad. A partir de las rondas eliminatorias el cuadro queda en múltiplo exacto de 4 sin ningún descanso.`
    : math.byesPerRound === 0
      ? 'No habrá descansos: al ser múltiplo de 4, todos los participantes juegan exactamente todas las rondas.'
      : `En cada ronda descansarán ${math.byesPerRound} jugadores de forma equilibrada por límite físico de mesas.`;

  const stageSummary = isElimination
    ? eliminationStages
        .map((s) => `${s.stageName} (${s.expectedParticipants} jug., ${s.tablesCount} ${s.tablesCount === 1 ? 'mesa' : 'mesas'})`)
        .join(' → ')
    : '';

  const summary = isElimination
    ? `Este torneo cuenta con ${math.participantCount} participantes en modalidad ${modalityTitle}. Se jugarán ${plan.selectedRounds} rondas de ${roundDurationMinutes} minutos (duración total estimada: ${plan.estimatedDurationMinutes} minutos): ${stageSummary}. ${byeSummary}`
    : `Este torneo cuenta con ${math.participantCount} participantes en modalidad ${modalityTitle}. Se organizarán ${tablesLabel} durante ${plan.selectedRounds} rondas de ${roundDurationMinutes} minutos (duración total estimada: ${plan.estimatedDurationMinutes} minutos). ${byeSummary}`;

  const rankingItems = isElimination
    ? [
        'Corte clasificatorio (al finalizar Clasificatoria 2): avanzan los mejores clasificados según porcentaje de efectividad ((Victorias + 0.5 × Empates) / Partidas jugadas), puntos de partida, victorias totales, diferencia promedio y puntos promedio a favor.',
        'Rondas eliminatorias (Cuartos / Semifinal): avanzan las parejas ganadoras de cada mesa. En caso excepcional de empate por tiempo en una mesa eliminatoria, avanza la pareja con mejor clasificación acumulada previa.',
        'Gran Final (1 sola partida de 4 jugadores): gana la Pareja Campeona de la Final y se corona Campeón Individual al integrante de la pareja ganadora con mejor rendimiento acumulado en el torneo (y su compañero queda como Subcampeón).'
      ]
    : [
        'Criterio 1: Puntos de partida (Victoria = 1, Empate por tiempo = 0.5, Derrota = 0).',
        'Criterio 2: Mayor número de victorias obtenidas.',
        'Criterio 3: Mayor diferencia total de puntos (Puntos a favor menos Puntos en contra).',
        'Criterio 4: Mayor cantidad total de puntos a favor.',
        'Criterio 5: Resultado en enfrentamientos directos como rivales (si existieron).',
        config.finalTieBreaker === 'playoff_match'
          ? 'Desempate final en la cima: si persiste igualdad exacta, se disputa una partida corta de desempate.'
          : 'Desempate final en la cima: si persiste igualdad exacta, se declara título compartido.'
      ];

  const schedulingItem = isElimination
    ? 'Emparejamiento por fase: en todas las fases se rotan parejas priorizando compañeros inéditos y mesas equilibradas competitivamente (1.º+4.º vs 2.º+3.º).'
    : config.schedulingMode === 'hybrid_competitive'
      ? 'Emparejamiento híbrido: los cruces de cada ronda se generan priorizando compañeros inéditos, variedad de rivales y equilibrio competitivo en rondas avanzadas.'
      : 'Calendario fijo previo: todas las mesas se generan antes de iniciar la Ronda 1 priorizando variedad de compañeros y rivales.';

  const sections: StructuredRuleSection[] = [
    {
      id: 'format',
      title: '1. Modalidad y estructura',
      items: isElimination
        ? [
            `Modalidad: ${modalityTitle} (4 jugadores reales por mesa, 2 contra 2).`,
            `Fases programadas: ${stageSummary}.`,
            schedulingItem
          ]
        : [
            `Modalidad: ${modalityTitle} (4 jugadores reales por mesa, 2 contra 2).`,
            'No existen eliminaciones deportivas: todos los inscritos permanecen en competencia hasta concluir las rondas programadas.',
            `Participantes: ${math.participantCount}. Mesas simultáneas: ${math.tablesPerRound}. Rondas programadas: ${plan.selectedRounds}.`,
            schedulingItem
          ]
    },
    {
      id: 'scoring_and_time',
      title: '2. Duración de rondas y puntuación',
      items: [
        `Cada partida tiene un objetivo de ${config.targetScore} puntos. Si una pareja alcanza o supera ${config.targetScore} puntos, su partida concluye inmediatamente.`,
        `Se registran los puntos reales completos obtenidos por cada pareja, sin recortar al límite de ${config.targetScore}.`,
        `Duración máxima de ronda: ${roundDurationMinutes} minutos, con aviso audiovisual cuando falten ${warningMinutesBeforeEnd} minutos y alarma al finalizar el tiempo.`,
        'Al agotarse el tiempo, las mesas en juego culminan únicamente la mano en curso y no inician una nueva mano.',
        'Finalizada la mano en curso tras agotarse el tiempo, se registran los puntos exactos tal como quedaron: gana la pareja con mayor puntuación y, si ambas quedan empatadas en puntos, la partida queda registrada como empate (sin muerte súbita ni ganador ni perdedor).'
      ]
    },
    {
      id: 'byes_and_withdrawals',
      title: '3. Descansos, sustitutos y retiros',
      items: [
        byeSummary,
        'Nunca se simulan jugadores ficticios ni mesas incompletas.',
        'Si un participante debe retirarse por causa de fuerza mayor, el organizador puede asignar un sustituto en su puesto (conservando las mesas exactas sin descansos) o registrar su retiro administrativo recalculando únicamente las rondas futuras sin alterar resultados previos.'
      ]
    },
    {
      id: 'ranking',
      title: '4. Criterios de clasificación y campeón',
      items: rankingItems
    },
    {
      id: 'integrity',
      title: '5. Integridad y correcciones',
      items: [
        'Los resultados se registran por pareja y se acreditan individualmente a cada uno de sus dos integrantes.',
        'La tabla de clasificación se recalcula siempre a partir de los resultados confirmados.',
        'Cualquier corrección administrativa posterior queda registrada en el historial de auditoría del torneo.'
      ]
    }
  ];

  const mdLines: string[] = ['# Reglamento Oficial del Torneo de Dominó', '', summary, ''];
  for (const section of sections) {
    mdLines.push(`## ${section.title}`, '');
    for (const item of section.items) {
      mdLines.push(`- ${item}`);
    }
    mdLines.push('');
  }

  return {
    version: '1.1.0',
    modality: 'individual_rotating_pairs',
    format: config.format,
    modalityTitle,
    summary,
    parameters: {
      format: config.format,
      participantCount: math.participantCount,
      tablesPerRound: math.tablesPerRound,
      byesPerRound: math.byesPerRound,
      plannedRounds: plan.selectedRounds,
      roundDurationMinutes,
      warningMinutesBeforeEnd,
      targetScore: config.targetScore,
      estimatedDurationMinutes: plan.estimatedDurationMinutes,
      equalGamesAchieved: plan.equalGamesAchieved,
      minGamesPerPlayer: plan.minGamesPerPlayer,
      maxGamesPerPlayer: plan.maxGamesPerPlayer,
      rankingMode: plan.rankingMode,
      schedulingMode: config.schedulingMode,
      tieResolutionRule: config.tieResolutionRule,
      finalTieBreaker: config.finalTieBreaker
    },
    sections,
    renderedMarkdown: mdLines.join('\n').trim()
  };
}
