export interface RoundTimerState {
  durationSeconds: number;
  warningBeforeEndSeconds: number;
  elapsedBeforeRunMs: number;
  timerStartedAtUtcMs: number | null;
  warningFiredAtUtcMs: number | null;
  expiredFiredAtUtcMs: number | null;
}

export interface RoundTimerSnapshot {
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  progressRatio: number;
  formatted: string;
  isRunning: boolean;
  isWarningZone: boolean;
  isExpired: boolean;
  shouldFireWarning: boolean;
  shouldFireExpired: boolean;
  clockMovedBackwards: boolean;
}

export function createInitialTimerState(
  durationSeconds: number,
  warningBeforeEndSeconds: number
): RoundTimerState {
  return {
    durationSeconds,
    warningBeforeEndSeconds,
    elapsedBeforeRunMs: 0,
    timerStartedAtUtcMs: null,
    warningFiredAtUtcMs: null,
    expiredFiredAtUtcMs: null
  };
}

export function startOrResumeRoundTimer(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerState {
  if (state.timerStartedAtUtcMs !== null) {
    return state;
  }
  return {
    ...state,
    timerStartedAtUtcMs: nowUtcMs
  };
}

export function pauseRoundTimer(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerState {
  if (state.timerStartedAtUtcMs === null) {
    return state;
  }
  const runDeltaMs = Math.max(0, nowUtcMs - state.timerStartedAtUtcMs);
  const totalMs = state.durationSeconds * 1000;
  const nextElapsed = Math.min(totalMs, state.elapsedBeforeRunMs + runDeltaMs);

  return {
    ...state,
    elapsedBeforeRunMs: nextElapsed,
    timerStartedAtUtcMs: null
  };
}

export function markWarningFired(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerState {
  if (state.warningFiredAtUtcMs !== null) {
    return state;
  }
  return {
    ...state,
    warningFiredAtUtcMs: nowUtcMs
  };
}

export function markExpiredFired(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerState {
  return {
    ...state,
    timerStartedAtUtcMs: null,
    elapsedBeforeRunMs: state.durationSeconds * 1000,
    warningFiredAtUtcMs: state.warningFiredAtUtcMs ?? nowUtcMs,
    expiredFiredAtUtcMs: state.expiredFiredAtUtcMs ?? nowUtcMs
  };
}

export function forceExpireRoundTimer(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerState {
  return markExpiredFired(state, nowUtcMs);
}

export function formatRemainingMMSS(remainingMs: number): string {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function computeTimerSnapshot(
  state: RoundTimerState,
  nowUtcMs: number
): RoundTimerSnapshot {
  const totalMs = state.durationSeconds * 1000;
  const warningMs = state.warningBeforeEndSeconds * 1000;

  let clockMovedBackwards = false;
  let activeRunMs = 0;

  if (state.timerStartedAtUtcMs !== null) {
    const rawDelta = nowUtcMs - state.timerStartedAtUtcMs;
    if (rawDelta < 0) {
      clockMovedBackwards = true;
      activeRunMs = 0;
    } else {
      activeRunMs = rawDelta;
    }
  }

  const rawElapsedMs = state.elapsedBeforeRunMs + activeRunMs;
  const elapsedMs = Math.min(totalMs, Math.max(0, rawElapsedMs));
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progressRatio = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 1;

  const isRunning = state.timerStartedAtUtcMs !== null;
  const isExpired = remainingMs === 0;
  const isWarningZone = !isExpired && warningMs > 0 && remainingMs <= warningMs;

  const shouldFireExpired = isExpired && state.expiredFiredAtUtcMs === null;
  // Never fire a stale 5-minute warning if the round has already expired
  const shouldFireWarning =
    !isExpired &&
    isRunning &&
    isWarningZone &&
    state.warningFiredAtUtcMs === null;

  return {
    totalMs,
    elapsedMs,
    remainingMs,
    progressRatio,
    formatted: formatRemainingMMSS(remainingMs),
    isRunning,
    isWarningZone,
    isExpired,
    shouldFireWarning,
    shouldFireExpired,
    clockMovedBackwards
  };
}
