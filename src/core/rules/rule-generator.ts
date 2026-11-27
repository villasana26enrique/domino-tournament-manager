import type {
  EliminationStagePlan,
  RoundPlanRecommendation,
  StructuredRuleSection,
  StructuredRulesDocument,
  TournamentConfig
} from '../domain/types.js';

export function generateTournamentRules(
  plan: RoundPlanRecommendation,
  config: TournamentConfig,
  eliminationStages: readonly EliminationStagePlan[] | null = null
): StructuredRulesDocument {
  const { math } = plan;
  const roundDurationMinutes = Math.round(config.roundDurationSeconds / 60);
  const warningMinutesBeforeEnd = Math.round(config.warningBeforeEndSeconds / 60);

  const tablesLabel =
    math.tablesPerRound === 1 ? '1 mesa simultánea' : `${math.tablesPerRound} mesas simultáneas`;

  const isElimination = config.format === 'qualifying_elimination' && eliminationStages !== null;

  const modalityTitle = isElimination
    ? 'Individual con parejas rotativas — Clasificatoria con eliminaciones hasta la Final'
    : 'Individual con parejas rotativas — Por rondas (todos juegan hasta el final)';

  const byeSummary = isElimination
    ? math.byesPerRound === 0
      ? 'No habrá descansos en ninguna fase: todas las mesas son exactas desde la Clasificatoria 1 hasta la Gran Final.'
      : `En la Clasificatoria 1 descansarán ${math.byesPerRound} ${
          math.byesPerRound === 1 ? 'jugador elegido' : 'jugadores elegidos'
        } al azar con pase libre a la Clasificatoria 2; en la Clasificatoria 2 juegan obligatoriamente y descansan otros ${
          math.byesPerRound
        } jugadores distintos. A partir de las rondas eliminatorias el cuadro queda en múltiplo exacto de 4 sin ningún descanso.`
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
