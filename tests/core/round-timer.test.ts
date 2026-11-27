import { describe, expect, it } from 'vitest';
import {
  computeTimerSnapshot,
  createInitialTimerState,
  formatRemainingMMSS,
  markExpiredFired,
  markWarningFired,
  pauseRoundTimer,
  startOrResumeRoundTimer
} from '../../src/core/timer/round-timer.js';

describe('RoundTimer (TDD — Wall-clock persistent timer & crash/sleep recovery)', () => {
  const MIN = 60_000;
  const T0 = 1_700_000_000_000;

  it('initializes a pending 25-minute timer with zero elapsed and formats 25:00', () => {
    const state = createInitialTimerState(1500, 300);
    const snap = computeTimerSnapshot(state, T0);

    expect(snap.elapsedMs).toBe(0);
    expect(snap.remainingMs).toBe(25 * MIN);
    expect(snap.formatted).toBe('25:00');
    expect(snap.shouldFireWarning).toBe(false);
    expect(snap.shouldFireExpired).toBe(false);
    expect(snap.isExpired).toBe(false);
    expect(snap.clockMovedBackwards).toBe(false);
  });

  it('tracks elapsed time across multiple pause and resume cycles without drift', () => {
    let state = createInitialTimerState(1500, 300);
    state = startOrResumeRoundTimer(state, T0);

    // Run for 10 minutes, then pause
    state = pauseRoundTimer(state, T0 + 10 * MIN);
    expect(state.elapsedBeforeRunMs).toBe(10 * MIN);
    expect(state.timerStartedAtUtcMs).toBeNull();

    // Wait 7 minutes while paused -> remaining MUST NOT change
    const duringPause = computeTimerSnapshot(state, T0 + 17 * MIN);
    expect(duringPause.remainingMs).toBe(15 * MIN);
    expect(duringPause.formatted).toBe('15:00');

    // Resume at T0 + 17m and inspect 4 minutes later (total elapsed = 14m, remaining = 11m)
    state = startOrResumeRoundTimer(state, T0 + 17 * MIN);
    const afterResume = computeTimerSnapshot(state, T0 + 21 * MIN);
    expect(afterResume.elapsedMs).toBe(14 * MIN);
    expect(afterResume.remainingMs).toBe(11 * MIN);
    expect(afterResume.formatted).toBe('11:00');
  });

  it('recovers after crash/sleep at 22 min (3 min left) and fires 5-min warning exactly once', () => {
    let state = createInitialTimerState(1500, 300);
    state = startOrResumeRoundTimer(state, T0);

    // App closed at 18 min and reopened at 22 min -> 3 min left <= 5 min warning
    const snap1 = computeTimerSnapshot(state, T0 + 22 * MIN);
    expect(snap1.remainingMs).toBe(3 * MIN);
    expect(snap1.formatted).toBe('03:00');
    expect(snap1.shouldFireWarning).toBe(true);
    expect(snap1.shouldFireExpired).toBe(false);

    // Persist warning fired flag -> never fires a duplicate warning
    state = markWarningFired(state, T0 + 22 * MIN);
    const snap2 = computeTimerSnapshot(state, T0 + 23 * MIN);
    expect(snap2.shouldFireWarning).toBe(false);
    expect(snap2.shouldFireExpired).toBe(false);
  });

  it('recovers after crash/sleep past expiration (28 min) firing ONLY final alarm, never stale 5-min warning', () => {
    let state = createInitialTimerState(1500, 300);
    state = startOrResumeRoundTimer(state, T0);

    // Reopen at 28 min -> expired 3 min ago
    const snap = computeTimerSnapshot(state, T0 + 28 * MIN);
    expect(snap.remainingMs).toBe(0);
    expect(snap.formatted).toBe('00:00');
    expect(snap.isExpired).toBe(true);
    expect(snap.shouldFireExpired).toBe(true);
    expect(snap.shouldFireWarning).toBe(false); // Never fire stale 5-min warning after expiry

    // Persist expired flag -> never fires duplicate final alarm
    state = markExpiredFired(state, T0 + 28 * MIN);
    const snapAfter = computeTimerSnapshot(state, T0 + 30 * MIN);
    expect(snapAfter.shouldFireExpired).toBe(false);
    expect(snapAfter.shouldFireWarning).toBe(false);
  });

  it('handles backward system clock jump safely without producing negative elapsed time', () => {
    let state = createInitialTimerState(1500, 300);
    state = startOrResumeRoundTimer(state, T0);

    const snap = computeTimerSnapshot(state, T0 - 5 * MIN);
    expect(snap.elapsedMs).toBe(0);
    expect(snap.remainingMs).toBe(25 * MIN);
    expect(snap.clockMovedBackwards).toBe(true);
  });

  it('rounds remaining display up to next full second cleanly', () => {
    expect(formatRemainingMMSS(0)).toBe('00:00');
    expect(formatRemainingMMSS(100)).toBe('00:01');
    expect(formatRemainingMMSS(59_001)).toBe('01:00');
    expect(formatRemainingMMSS(1_500_000)).toBe('25:00');
  });
});
