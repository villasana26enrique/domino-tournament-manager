import type { Translations } from './en.js';

export const es: Translations = {
  app: {
    title: 'Domino Tournament Manager',
    subtitle: 'Gestión local offline-first',
    homeNav: 'Inicio',
    modalitiesNav: 'Modalidades y reglamentos',
    modalitiesShortNav: 'Reglas',
    closeAlert: 'Cerrar aviso',
    unexpectedError: 'Ocurrió un error inesperado.',
    pinProtect: 'Proteger con PIN',
    pinShort: 'PIN',
    pinLocked: 'Bloqueado',
    pinUnlocked: 'Organizador'
  },
  home: {
    badge: 'Offline-first · Parejas rotativas · Justo y explicable',
    heroTitle: 'Organiza tu torneo de dominó en minutos',
    heroDescription:
      'Inscribe a los jugadores y el motor arma mesas completas, evita compañeros repetidos y genera automáticamente el reglamento oficial listo para empezar.',
    tournamentNameLabel: 'Nombre del torneo',
    tournamentNamePlaceholder: 'Ej. Copa Vecinos del Sábado',
    createButton: 'Crear torneo',
    activeSectionTitle: 'Torneos activos y borradores',
    recordSingular: 'registro',
    recordPlural: 'registros',
    emptyTitle: 'Todavía no hay torneos creados',
    emptyDescription:
      'Escribe un nombre arriba y presiona “Crear torneo” para registrar a los participantes.',
    participantsCount: (n: number) => `${n} participantes`,
    formatRounds: 'Por rondas',
    formatElimination: 'Clasificatoria + Eliminaciones',
    deleteAria: (name: string) => `Eliminar ${name}`,
    deleteButton: 'Eliminar',
    continueTournament: 'Continuar torneo',
    openDraft: 'Abrir',
    completedSectionTitle: 'Historial finalizado',
    completedMeta: (players: number, rounds: number) => `${players} jugadores · ${rounds} rondas`,
    viewSummary: 'Ver resumen',
    sidebarModalitiesTitle: 'Modalidades y reglamentos',
    sidebarModalitiesDesc:
      'Consulta cómo funcionan los torneos Por rondas (solo múltiplos de 4 sin descansos) y Clasificatoria con eliminaciones hasta la Final, además de reglas de tiempo y desempates.',
    viewModalitiesButton: 'Ver modalidades y reglamentos',
    sidebarBackupTitle: 'Respaldo y portabilidad',
    sidebarBackupDesc:
      'Exporta o restaura tus torneos en un archivo JSON local para respaldar o mover datos a otro equipo.',
    backupButton: 'Respaldo local',
    sidebarTimeRuleTitle: 'Regla de cierre por tiempo',
    sidebarTimeRuleDesc:
      'Al agotarse los 25 minutos, se culmina únicamente la mano en curso y se anotan los puntos exactos. Si hay igualdad, queda registrada como empate (sin muerte súbita).',
    status: {
      draft: 'Borrador',
      ready: 'Listo',
      in_progress: 'En curso',
      completed: 'Finalizado',
      cancelled: 'Cancelado'
    }
  },
  registration: {
    backHome: 'Volver al inicio',
    title: 'Registro de participantes',
    tournamentLabel: 'Torneo:',
    generateButton: 'Generar torneo',
    registeredSingular: 'participante registrado',
    registeredPlural: 'participantes registrados',
    tablesCount: (n: number) => `${n} ${n === 1 ? 'mesa' : 'mesas'}`,
    needMorePlayers: (missing: number) =>
      `Faltan ${missing} participantes para completar al menos 1 mesa de 4 jugadores.`,
    multipleOf4Banner:
      'Es múltiplo exacto de 4: en el siguiente paso podrás elegir entre “Por rondas” (0 descansos) o “Clasificatoria con eliminaciones hasta la Final”.',
    singleNameLabel: 'Nombre del participante',
    singleNamePlaceholder: 'Ej. Enrique Villasana',
    addPlayerButton: 'Añadir jugador',
    bulkLabel: 'Pegar lista de jugadores',
    bulkHint: '1 nombre por línea',
    bulkPlaceholder: 'Carlos\nMaría\nJosé\nAna',
    addListButton: 'Agregar lista',
    quickSampleTitle: 'Cargar grupo de prueba rápido',
    quickSamplePlayers: (n: number) => `${n} jugadores`,
    rosterTitle: (n: number) => `Lista inscrita (${n})`,
    autoNumbering: 'Numeración automática',
    emptyRoster: 'Aún no hay jugadores registrados en este torneo.',
    saveNameAria: 'Guardar nombre',
    editPlayerAria: (name: string) => `Editar ${name}`,
    removePlayerAria: (name: string) => `Retirar ${name}`
  },
  preview: {
    editParticipants: 'Editar participantes',
    title: 'Previsualización del torneo',
    subtitlePrefix: 'Revisa la modalidad, las mesas iniciales y el reglamento oficial antes de iniciar',
    regenerateSeed: 'Regenerar sorteo',
    confirmAndStart: 'Confirmar e iniciar torneo',
    formatSectionTitle: 'Modalidad del torneo',
    selectedBadge: 'Seleccionada',
    requiresMultipleOf4: 'Requiere múltiplo de 4',
    initialTables: 'Mesas iniciales',
    activeAndByes: (active: number, byes: number) =>
      `${active} activos · ${byes} ${byes === 1 ? 'descanso' : 'descansos'}`,
    totalRounds: 'Rondas totales',
    roundsAllPlayHint: 'Todos juegan igual (0 descansos)',
    roundsElimHint: 'Hasta Gran Final de 1 partida',
    estimatedDuration: 'Duración estimada',
    minutesPerRound: (mins: number) => `${mins} min por ronda`,
    matchTarget: 'Meta de partida',
    pointsUnit: (pts: number) => `${pts} pts`,
    uncappedPointsHint: 'Puntos reales sin recorte',
    quickSettings: 'Ajustes rápidos',
    targetScoreLabel: 'Objetivo de puntos',
    pointsOption: (pts: number) => `${pts} puntos`,
    roundDurationLabel: 'Duración de ronda',
    minutesOption: (mins: number) => `${mins} minutos`,
    roundsCountLabel: 'Cantidad de rondas',
    roundsOption: (r: number, recommended: boolean) =>
      `${r} rondas${recommended ? ' (Recomendado)' : ''}`,
    pairingModeLabel: 'Generación de cruces',
    pairingHybrid: 'Híbrido competitivo (Recomendado)',
    pairingFixed: 'Calendario fijo previo',
    eliminationStagesTitle: 'Fases eliminatorias programadas',
    stageMeta: (p: number, t: number, b: number) =>
      `${p} jug. · ${t} ${t === 1 ? 'mesa' : 'mesas'} · ${b > 0 ? `${b} pase libre` : '0 descansos'}`,
    round1PreviewTitle: (stageName: string) => `Vista previa — ${stageName}`,
    seedLabel: (seed: string) => `Semilla: ${seed}`,
    tableLabel: (n: number) => `Mesa ${n}`,
    pairA: 'Pareja A',
    pairB: 'Pareja B',
    vs: 'VS',
    r1ByesQualifying: 'Pase libre al azar en Clasificatoria 1 (avanzan directo a Ronda 2)',
    r1ByesRegular: 'Descansan en Ronda 1',
    generatedRulesTitle: 'Reglamento oficial generado',
    downloadRulesPdf: 'Descargar reglamento PDF'
  },
  active: {
    leaveHome: 'Salir al inicio',
    startedBadge: 'Torneo iniciado',
    autoSaveBadge: 'Guardado automático local',
    roundProgress: (stage: string, cur: number, total: number, target: number) =>
      `${stage} (Ronda ${cur} de ${total}) · Meta ${target} pts`,
    projectionButton: 'Modo proyección',
    rulesFrozenBadge: 'Reglamento oficial congelado',
    tabs: {
      tables: 'Mesas y resultados',
      standings: 'Clasificación',
      bracket: 'Llave',
      participants: 'Participantes',
      rulesAudit: 'Reglamento y auditoría'
    },
    allMatchesDone: (stage: string) => `Todas las mesas de ${stage} tienen resultado confirmado.`,
    pendingMatches: (count: number) =>
      `Faltan ${count} ${count === 1 ? 'mesa' : 'mesas'} por registrar resultado.`,
    simulateButton: 'Simular resultados (Prueba)',
    finalizeTournament: 'Finalizar torneo',
    closeAndAdvance: 'Cerrar ronda y avanzar',
    tableLabel: (n: number) => `Mesa ${n}`,
    drawScore: (a: number, b: number) => `Empate (${a} - ${b})`,
    pendingBadge: 'Pendiente',
    pairA: 'Pareja A',
    pairB: 'Pareja B',
    winnerTag: '· Ganadora',
    correctResult: 'Corregir resultado',
    recordResult: 'Registrar resultado',
    correctProtectAction: (table: number) => `corregir la Mesa ${table}`,
    r1ByesQualifying: 'Pase libre al azar en Clasificatoria 1 (avanzan a Ronda 2)',
    byesRegular: (stage: string) => `Descansan en ${stage}`,
    standingsTitle: 'Tabla de clasificación en vivo',
    standingsHint: 'Recalculada desde actas confirmadas',
    participantsHelp:
      'Si un participante debe ausentarse, puedes asignar un sustituto para mantener las mesas exactas sin descansos, o registrar su retiro administrativo para las rondas futuras sin alterar resultados ya completados.',
    statusActive: 'Activo',
    statusEliminated: (r: number) => `Eliminado tras R${r}`,
    statusWithdrawn: (r: number) => `Retirado tras R${r}`,
    substitutedFor: (name: string) => `Sustituyó a ${name}`,
    substituteBtn: 'Sustituir',
    withdrawBtn: 'Retirar',
    subProtectAction: (name: string) => `sustituir a ${name}`,
    withdrawProtectAction: (name: string) => `retirar a ${name}`,
    subNameLabel: (name: string) => `Nombre del sustituto para ${name}`,
    subPlaceholder: 'Ej. Carlos (Sustituto)',
    cancel: 'Cancelar',
    confirmSub: 'Confirmar sustituto',
    withdrawConfirmPrefix: '¿Confirmas el retiro administrativo de',
    withdrawConfirmSuffix: 'Solo se recalcularán rondas futuras.',
    confirmWithdraw: 'Confirmar retiro',
    frozenRulesTitle: 'Reglamento oficial congelado',
    downloadRulesPdf: 'Descargar reglamento PDF',
    auditTitle: 'Historial de resultados y correcciones',
    noAuditLogs: 'Todavía no se han registrado resultados en este torneo.',
    auditCorrectionLabel: (r: number, t: number) => `Ronda ${r} · Mesa ${t} — Corrección administrativa`,
    auditRecordLabel: (r: number, t: number) => `Ronda ${r} · Mesa ${t} — Registro`,
    auditPrevDetail: (pa: number, pb: number, reason: string) =>
      `Marcador anterior: ${pa} - ${pb}. Motivo: ${reason}`
  },
  completed: {
    backHome: 'Volver al inicio',
    downloadReportPdf: 'Descargar reporte PDF',
    downloadRulesPdf: 'Descargar reglamento PDF',
    print: 'Imprimir',
    finishedBanner: (name: string) => `Torneo finalizado · ${name}`,
    individualChampion: 'Campeón Individual',
    championRecord: (num: number, w: number, d: number, l: number, diff: string) =>
      `#${num} · ${w}V - ${d}E - ${l}D · Diferencia ${diff} pts`,
    winningPairTitle: (a: number, b: number) => `Pareja Ganadora de la Final (${a} - ${b})`,
    winningPairSubtitle: 'Gran Final disputada a 1 sola partida decisiva entre los 4 finalistas.',
    bracketSectionTitle: 'Llave del torneo (Ruta a la Final)',
    statsTitle: 'Estadísticas del torneo',
    matchesPlayed: 'Partidas jugadas',
    timeDrawsCount: (n: number) => `${n} ${n === 1 ? 'empate por tiempo' : 'empates por tiempo'}`,
    totalPoints: 'Puntos totales anotados',
    noRepeatPartners: '0 compañeros repetidos',
    repeatPartners: (n: number) => `${n} repeticiones de compañero`,
    highestScore: 'Mayor puntaje en mesa',
    highestScoreDetail: (score: number, r: number, t: number, loser: number) =>
      `R${r} Mesa ${t} (${score}-${loser})`,
    noData: 'N/D',
    largestMargin: 'Mayor margen de victoria',
    largestMarginDetail: (r: number, t: number, w: number, l: number) =>
      `R${r} Mesa ${t} (${w}-${l})`,
    finalStandings: 'Clasificación definitiva',
    roundsSummary: 'Resumen de rondas y mesas',
    tableShort: (n: number) => `M${n}:`,
    correctionsTitle: 'Correcciones administrativas registradas',
    correctionItem: (r: number, t: number, pa: number, pb: number, na: number, nb: number, reason: string) =>
      `Ronda ${r}, Mesa ${t}: ${pa}-${pb} → ${na}-${nb} (${reason})`
  },
  modalities: {
    backHome: 'Volver al inicio',
    title: 'Modalidades y reglamentos',
    subtitle:
      'Guía clara de los formatos disponibles en esta versión y de las modalidades previstas para futuras versiones.',
    implementedHeading: 'Implementada en el MVP',
    availableBadge: 'Disponible',
    roundsTitle: 'Individual con parejas rotativas — Por rondas',
    roundsDesc:
      'Ideal cuando la cantidad de jugadores es múltiplo de 4 (8, 12, 16, 20, 24...). Todos disputan exactamente las mismas rondas con 0 descansos y sin eliminaciones, rotando de compañero en cada ronda.',
    elimTitle: 'Individual con parejas rotativas — Clasificatoria + Eliminaciones',
    elimDesc:
      'Disponible para cualquier cantidad desde 4 jugadores. Inicia con 2 rondas clasificatorias (si no es múltiplo de 4, quienes descansan al azar en R1 tienen pase libre y juegan R2), corta a múltiplo exacto de 4 (16 → 8 → 4) con 0 descansos y cierra con una Gran Final de 1 sola partida.',
    plannedHeading: 'Próximamente',
    plannedBadge: 'Prevista',
    plannedItems: [
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
    ],
    coreRulesTitle: 'Reglas generales de puntuación, tiempo y contingencias',
    coreRulesItems: [
      'Meta de 100 puntos sin recorte: si una pareja termina con 133 puntos contra 84, se registran exactamente 133 y 84 para el diferencial individual.',
      'Cierre por tiempo (25 min): al sonar la alarma se termina solo la mano en curso y se anotan los puntos exactos. Si hay igualdad de puntos, queda registrada como empate (0.5 puntos de partida, sin muerte súbita).',
      'Si alguien debe retirarse a mitad del torneo: el organizador puede asignar un sustituto (conservando mesas exactas sin descansos) o registrar retiro administrativo recalculando solo rondas futuras.'
    ]
  },
  bracket: {
    roadToFinal: 'Ruta a la Final',
    qualifyingTitle: 'Clasificatoria (R1–R2)',
    exactCutTo: (n: number) => `Corte exacto a ${n} jugadores`,
    cutDefined: 'Corte definido',
    inProgress: 'En juego',
    qualifiedTo: (stage: string, n: number) => `Clasificados a ${stage} (${n})`,
    cutZone: (n: number) => `Zona de clasificación (Top ${n})`,
    eliminatedAtCut: 'Eliminados en corte',
    belowCut: 'Por debajo del corte',
    playersTables: (p: number, t: number) => `${p} jugadores · ${t} ${t === 1 ? 'mesa' : 'mesas'}`,
    stageDefined: 'Definida',
    stageActive: 'En juego',
    stagePending: 'Pendiente',
    tableNumber: (n: number) => `Mesa ${n}`,
    toBePlayed: 'Por jugar',
    championsTag: 'Campeones',
    advancesTag: 'Avanza',
    pairA: 'Pareja A',
    pairB: 'Pareja B',
    tableTbd: (n: number) => `Mesa ${n} · Por definir`,
    waitingPreviousStage: 'Esperando clasificados de la fase anterior.',
    championHeading: 'Campeón',
    individualChampion: 'Campeón Individual',
    winningFinalPair: 'Pareja Ganadora Final',
    tbdTitle: 'Por definir',
    tbdChampionDesc: 'Se proclama al cierre de la Gran Final.'
  },
  projection: {
    tablesAndClock: 'Mesas y reloj',
    liveBracket: 'Llave en vivo',
    exitProjection: 'Salir de proyección',
    expiredStatus: 'Tiempo agotado — Terminar únicamente la mano en curso',
    warningStatus: 'Últimos minutos de la ronda',
    runningStatus: 'Ronda en juego',
    pausedStatus: 'Cronómetro pausado / listo para iniciar',
    tableBadge: (n: number) => `Mesa ${n}`,
    playingBadge: 'En juego',
    pairA: 'Pareja A',
    pairB: 'Pareja B',
    byesLabel: 'Descansan / Pase libre:'
  },
  timer: {
    statusLabels: {
      pending: 'Lista para iniciar',
      in_progress: 'En juego',
      paused: 'Pausada',
      time_expired: 'Tiempo agotado — Terminar mano en curso',
      recording_results: 'Registrando resultados',
      completed: 'Ronda completada'
    },
    clockAria: 'Tiempo restante de la ronda',
    durationLabel: (mins: number) => `Duración: ${mins} min`,
    resume: 'Reanudar',
    startRound: 'Iniciar ronda',
    pause: 'Pausar',
    endTime: 'Finalizar tiempo',
    enableSoundAria: 'Activar sonido',
    muteSoundAria: 'Silenciar alarma',
    mutedLabel: 'Silenciado',
    soundActiveLabel: 'Alarma activa',
    testSoundAria: 'Probar sonido',
    testSoundLabel: 'Probar',
    warningNotice: (mins: number) => `Aviso: quedan ${mins} minutos para finalizar la ronda.`,
    expiredNotice:
      '¡Tiempo agotado! Terminen únicamente la mano en curso y registren los puntos exactos.',
    clockBackwardsNotice:
      'Se detectó un ajuste en el reloj del sistema; el tiempo previo se conservó sin pérdida.',
    expiredBanner:
      'Tiempo agotado: culminen la mano en curso y anoten los puntos reales (si empatan, queda registrado empate).',
    warningBanner: 'Últimos minutos de la ronda en curso.'
  },
  standings: {
    pos: 'Pos',
    player: 'Jugador',
    gp: 'PJ',
    w: 'V',
    d: 'E',
    l: 'D',
    pts: 'Pts',
    winPct: '% Efect.',
    pf: 'PF',
    pa: 'PC',
    diff: 'Dif',
    byes: 'Desc.',
    eliminatedBadge: 'Eliminado',
    withdrawnBadge: 'Retirado',
    substituteBadge: 'Sustituto'
  },
  matchModal: {
    correctTitle: (t: number) => `Corregir resultado — Mesa ${t}`,
    recordTitle: (t: number) => `Registrar resultado — Mesa ${t}`,
    subtitle: (target: number) => `Meta: ${target} pts · Se registran puntos reales sin recorte`,
    closeAria: 'Cerrar ventana',
    pairA: 'Pareja A',
    pairB: 'Pareja B',
    scorePairA: 'Puntos Pareja A',
    scorePairB: 'Puntos Pareja B',
    endReasonLabel: 'Motivo de cierre',
    endReasonTarget: (pts: number) => `Alcanzó o superó la meta (${pts} pts)`,
    endReasonTime: 'Se agotó el tiempo (terminó mano en curso)',
    endReasonAdmin: 'Corrección administrativa',
    correctionReasonLabel: 'Motivo de corrección (queda en auditoría)',
    correctionReasonPlaceholder: 'Ej. Error al transcribir hoja de Mesa 1',
    missingNumbersError: 'Ingresa los puntajes numéricos de ambas parejas.',
    missingCorrectionReasonError: 'Debes escribir el motivo de la corrección administrativa.',
    validDrawFeedback: (a: number, b: number) =>
      `Resultado válido: Empate por tiempo (${a} - ${b}), sin ganador ni perdedor.`,
    validWinFeedback: (pair: string, a: number, b: number) =>
      `Gana Pareja ${pair} (${a} - ${b}).`,
    cancel: 'Cancelar',
    saveCorrection: 'Guardar corrección',
    confirmResult: 'Confirmar resultado'
  },
  leaveModal: {
    title: '¿Salir de la vista del torneo?',
    subtitlePrefix: 'Estás saliendo de',
    reassurance:
      'No te preocupes: tu torneo sigue guardado automáticamente en este equipo y puedes retomarlo desde el inicio con “Continuar torneo”.',
    timerRunningNote:
      'El cronómetro de la ronda actual seguirá contando el tiempo transcurrido aunque salgas al inicio.',
    stayButton: 'Seguir en el torneo',
    leaveButton: 'Sí, salir al inicio'
  },
  deleteModal: {
    title: '¿Eliminar torneo?',
    subtitlePrefix: 'Vas a eliminar',
    warnings: {
      draft: 'Se eliminará este borrador y la lista de participantes registrados.',
      ready: 'Se eliminará este torneo preparado y su lista de participantes.',
      in_progress:
        'Este torneo está EN CURSO. Si lo eliminas, se perderán permanentemente sus rondas, cronómetro y marcadores.',
      completed:
        'Este torneo ya está FINALIZADO. Si lo eliminas, se perderán su campeón, clasificación e historial.',
      cancelled: 'Se eliminará permanentemente este registro.'
    },
    irreversibleSuffix: 'Esta acción no se puede deshacer.',
    cancel: 'Cancelar',
    confirmDelete: 'Sí, eliminar'
  },
  backupModal: {
    title: 'Respaldo y restauración local',
    subtitle: 'Guarda una copia de tus torneos en un archivo JSON o restáurala en otro equipo.',
    closeAria: 'Cerrar',
    exportHeading: '1. Exportar respaldo',
    exportCount: (n: number) =>
      `Actualmente hay ${n} ${n === 1 ? 'torneo guardado' : 'torneos guardados'} localmente.`,
    exportButton: 'Descargar respaldo (.json)',
    exportedSuccess: (n: number) =>
      `Respaldo exportado (${n} ${n === 1 ? 'torneo' : 'torneos'}).`,
    importHeading: '2. Restaurar desde respaldo',
    selectFileLabel: 'Seleccionar archivo .json',
    pasteJsonLabel: 'Pegar respaldo JSON',
    emptyJsonError: 'Selecciona un archivo .json o pega el contenido del respaldo.',
    restoreSuccess: (imported: number, updated: number, total: number) =>
      `Restauración completada: ${imported} importado(s), ${updated} actualizado(s). Total en equipo: ${total}.`,
    restoreFailed: 'No se pudo restaurar el respaldo.',
    restoreButton: 'Restaurar respaldo',
    closeButton: 'Cerrar'
  },
  pinModal: {
    setupTitle: 'Proteger con PIN de organizador',
    unlockTitle: 'PIN de organizador',
    manageTitle: 'Modo organizador desbloqueado',
    setupDesc:
      'Crea un PIN local de 4 a 6 dígitos (sin cuentas ni login) para ocultar herramientas de prueba y proteger eliminación, correcciones y retiros.',
    unlockActionDesc: (action: string) => `Ingresa el PIN de organizador para ${action}.`,
    unlockGenericDesc:
      'Ingresa tu PIN local de 4 a 6 dígitos para desbloquear acciones de organizador.',
    manageDesc:
      'Las acciones sensibles están habilitadas en esta sesión. Puedes volver a bloquearlas en cualquier momento o quitar el PIN.',
    newPinLabel: 'Nuevo PIN (4 a 6 dígitos)',
    newPinPlaceholder: 'Ej. 2468',
    confirmPinLabel: 'Confirmar PIN',
    confirmPinPlaceholder: 'Repite el PIN',
    mismatchError: 'Los dos campos de PIN no coinciden.',
    enterPinLabel: 'Ingresa el PIN',
    enterPinPlaceholder: '4 a 6 dígitos',
    wrongPinError: 'PIN incorrecto. Verifica e intenta de nuevo.',
    clearWrongPinError: 'PIN incorrecto. No se pudo quitar la protección.',
    cancel: 'Cancelar',
    saveAndLock: 'Guardar y bloquear',
    unlockButton: 'Desbloquear',
    activeBanner: 'Protección activa para esta máquina',
    lockNow: 'Bloquear ahora',
    currentPinLabel: 'PIN actual para confirmar (si deseas quitar el PIN)',
    currentPinPlaceholder: 'PIN actual',
    close: 'Cerrar',
    removePin: 'Quitar PIN'
  }
};
