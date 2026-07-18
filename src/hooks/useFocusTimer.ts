import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AlertSound,
  AppMode,
  CycleItem,
  DisplayState,
  Phase,
  SessionRow,
  SnapshotRow,
  SubMode,
  TemplateRow,
  UserSettings,
} from '../types';
import {
  announceBreakStart,
  announceNextCycleStart,
  cancelSpeech,
  cueEndingSoon,
  playBeep,
  speakSequence,
} from '../lib/audio';
import {
  dbAbandonSession,
  dbAppendCycleExtension,
  dbDeleteSnapshot,
  dbEndCycle,
  dbEndSession,
  dbFindInterruptedSession,
  dbRegisterCycleRestart,
  dbSaveSnapshot,
  dbStartCycle,
  dbStartSession,
  dbUpdateCycleLog,
} from '../lib/db';
import { notifyRecoverableChanged } from '../lib/events';
import { formatClock } from '../lib/time';

export interface EngineState {
  // config
  appMode: AppMode;
  subMode: SubMode;
  schedule: CycleItem[];
  sessionName: string;

  startMin: number;
  endMin: number;
  stepMin: number;
  direction: 'decreasing' | 'increasing';
  breakSeconds: number;
  alertSound: AlertSound;
  stdTaskLabel: string;

  tBreakSeconds: number;
  tAlertSound: AlertSound;

  acTarget: number;
  acStart: number;
  acStep: number;
  autoHint: string;

  manualAddValue: number;

  // runtime
  phase: Phase;
  phaseBeforePause: Phase | null;
  scheduleIndex: number;
  currentCycleMin: number;
  endMinutes: number;
  remainingSeconds: number;
  breakRemaining: number;
  autopilot: boolean;
  completedCyclesCount: number;
  currentSessionId: string | null;
  currentCycleLogId: string | null;
  pausedSecondsInCycle: number;
  pendingBreakPauseReason: string | null;
  currentCycleExtensions: number[];
  currentCycleRestartCount: number;
  errorMsg: string;
  display: DisplayState;
  lockedByOtherTab: boolean;

  // modals
  modeModalOpen: boolean;
  reviewModalOpen: boolean;
  reviewQuestion: string;
  tplNameModalOpen: boolean;

  // long-pause reason prompt
  pauseReasonPromptOpen: boolean;
  pauseReasonContext: 'cycle' | 'break' | null;
  pauseReasonAwaySeconds: number;

  // end-of-cycle extend/restart choice (Target mode only)
  cycleEndChoiceOpen: boolean;

  // resume banner
  resumeBannerVisible: boolean;
  resumeBannerSub: string;
  pendingResume: { session: SessionRow; snapshot: SnapshotRow } | null;
}

function initialState(): EngineState {
  return {
    appMode: 'standard',
    subMode: 'auto',
    schedule: [],
    sessionName: '',

    startMin: 30,
    endMin: 10,
    stepMin: 1,
    direction: 'decreasing',
    breakSeconds: 10,
    alertSound: 'beep',
    stdTaskLabel: '',

    tBreakSeconds: 10,
    tAlertSound: 'beep',

    acTarget: 180,
    acStart: 30,
    acStep: 1,
    autoHint: 'Enter values and click Generate.',

    manualAddValue: 30,

    phase: 'idle',
    phaseBeforePause: null,
    scheduleIndex: 0,
    currentCycleMin: 30,
    endMinutes: 0,
    remainingSeconds: 0,
    breakRemaining: 0,
    autopilot: true,
    completedCyclesCount: 0,
    currentSessionId: null,
    currentCycleLogId: null,
    pausedSecondsInCycle: 0,
    pendingBreakPauseReason: null,
    currentCycleExtensions: [],
    currentCycleRestartCount: 0,
    errorMsg: '',
    display: { time: '30:00', cycle: 'Ready', status: '', progress: '', task: '', paused: false, fraction: 1, isBreak: false },
    lockedByOtherTab: false,

    modeModalOpen: false,
    reviewModalOpen: false,
    reviewQuestion: '',
    tplNameModalOpen: false,

    pauseReasonPromptOpen: false,
    pauseReasonContext: null,
    pauseReasonAwaySeconds: 0,
    cycleEndChoiceOpen: false,

    resumeBannerVisible: false,
    resumeBannerSub: '',
    pendingResume: null,
  };
}

function fmt(s: number): string {
  return formatClock(s);
}

export function useFocusTimer(userId: string | null, settings: UserSettings | null) {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const s = useRef<EngineState>(initialState());
  const patch = useCallback(
    (p: Partial<EngineState>) => {
      Object.assign(s.current, p);
      bump();
    },
    [bump]
  );

  const intervalRef = useRef<number | null>(null);
  const runTokenRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pendingResumeElapsedRef = useRef<number>(0);
  const cycleEndInfoRef = useRef<{ completedNum: number; isLast: boolean } | null>(null);
  const settingsRef = useRef<UserSettings | null>(settings);
  settingsRef.current = settings;
  const getTransitionSeconds = useCallback(() => settingsRef.current?.transition_seconds ?? 3, []);
  const getBreakTransitionSeconds = useCallback(
    () => (settingsRef.current?.transition_before_break === false ? 0 : settingsRef.current?.transition_seconds ?? 3),
    []
  );
  const reviewResolveRef = useRef<((v: { answer: 'yes' | 'no' | null; note: string }) => void) | null>(
    null
  );
  const popWinRef = useRef<Window | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  // ───────────────────────── cross-tab session lock ─────────────────────────
  // Prevents two tabs from each thinking they own the active session (the
  // "opening in two tabs shows inconsistent state" bug). This does NOT mirror
  // the live countdown between tabs second-by-second — that would need a
  // shared timer authority broadcasting ticks, a materially bigger change.
  // What it does guarantee: only one tab can ever be "the" running session at
  // a time, and every other tab knows about it immediately.
  const LOCK_KEY = 'focusflow:active-lock';
  const LOCK_STALE_MS = 4 * 60 * 60 * 1000; // 4h — safety net for a crashed tab only
  const tabIdRef = useRef<string>(
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  );

  const readLock = useCallback((): { sessionId: string; tabId: string; updatedAt: number } | null => {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const writeLock = useCallback((sessionId: string) => {
    try {
      localStorage.setItem(
        LOCK_KEY,
        JSON.stringify({ sessionId, tabId: tabIdRef.current, updatedAt: Date.now() })
      );
    } catch {
      /* ignore (e.g. private-browsing quota) */
    }
  }, []);

  const clearLockIfOwned = useCallback(() => {
    const lock = readLock();
    if (lock && lock.tabId === tabIdRef.current) {
      try {
        localStorage.removeItem(LOCK_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [readLock]);

  const refreshLockStatus = useCallback(() => {
    const lock = readLock();
    const ownedElsewhere =
      !!lock && lock.tabId !== tabIdRef.current && Date.now() - lock.updatedAt < LOCK_STALE_MS;
    if (ownedElsewhere !== s.current.lockedByOtherTab) {
      patch({ lockedByOtherTab: ownedElsewhere });
    }
  }, [readLock, patch]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getBreakSeconds = useCallback(
    () => (s.current.appMode === 'standard' ? s.current.breakSeconds : s.current.tBreakSeconds),
    []
  );
  const getAlertSound = useCallback(
    () => (s.current.appMode === 'standard' ? s.current.alertSound : s.current.tAlertSound),
    []
  );
  const getCurrentLabel = useCallback(() => {
    if (s.current.appMode === 'standard') return s.current.stdTaskLabel.trim();
    return (s.current.schedule[s.current.scheduleIndex] || { label: '' }).label || '';
  }, []);

  const progressLabel = useCallback(() => {
    if (s.current.appMode !== 'target' || !s.current.schedule.length) return '';
    const total = s.current.schedule.length;
    const doneMin = s.current.schedule
      .slice(0, s.current.scheduleIndex)
      .reduce((a, b) => a + b.min, 0);
    const totalMin = s.current.schedule.reduce((a, b) => a + b.min, 0);
    return `Cycle ${s.current.scheduleIndex + 1} of ${total}  ·  ${doneMin}/${totalMin} min done`;
  }, []);

  const PW_RING_R = 52;
  const PW_RING_C = 2 * Math.PI * PW_RING_R;

  const applyWidgetState = useCallback((root: Document | HTMLElement, d: DisplayState) => {
    const q = (id: string) => (root as Document).getElementById
      ? (root as Document).getElementById(id)
      : (root as HTMLElement).querySelector(`#${id}`);

    const timeEl = q('pw-time') as HTMLElement | null;
    const cycleEl = q('pw-cycle') as HTMLElement | null;
    const statusEl = q('pw-status') as HTMLElement | null;
    const progEl = q('pw-prog') as HTMLElement | null;
    const taskEl = q('pw-task') as HTMLElement | null;
    const ringEl = q('pw-ring-fill') as unknown as SVGCircleElement | null;
    const barEl = q('pw-bar-fill') as HTMLElement | null;
    const cardEl = q('pw-card') as HTMLElement | null;

    if (timeEl) timeEl.textContent = d.time;
    if (cycleEl) cycleEl.textContent = d.cycle;
    if (statusEl) statusEl.textContent = d.status;
    if (progEl) progEl.textContent = d.progress || '';
    if (taskEl) taskEl.textContent = d.task || '';

    const accent = d.isBreak ? '#E8A23D' : '#3B8A81';
    if (timeEl) timeEl.style.color = d.paused ? '#E8A23D' : '#EEF1EE';
    if (ringEl) {
      const offset = PW_RING_C * (1 - d.fraction);
      ringEl.style.strokeDashoffset = String(offset);
      ringEl.style.stroke = d.paused ? '#E8A23D' : accent;
    }
    if (barEl) {
      barEl.style.width = `${Math.round(Math.max(0, Math.min(1, d.fraction)) * 100)}%`;
      barEl.style.background = d.paused ? '#E8A23D' : accent;
    }
    if (cardEl) cardEl.setAttribute('data-paused', d.paused ? '1' : '0');
  }, []);

  const pushToPopout = useCallback(
    (d: DisplayState) => {
      const w = popWinRef.current;
      if (!w || w.closed) return;
      try {
        applyWidgetState(w.document, d);
      } catch {
        /* ignore */
      }
    },
    [applyWidgetState]
  );

  const pushToPiP = useCallback(
    (d: DisplayState) => {
      const c = pipContainerRef.current;
      if (!c) return;
      try {
        applyWidgetState(c, d);
      } catch {
        /* ignore */
      }
    },
    [applyWidgetState]
  );

  const syncDisplay = useCallback(
    (time: string, cycle: string, status: string) => {
      const isBreak = s.current.phase === 'break' || (s.current.phase === 'paused' && s.current.phaseBeforePause === 'break');
      const totalSeconds = isBreak
        ? s.current.appMode === 'standard'
          ? s.current.breakSeconds
          : s.current.tBreakSeconds
        : s.current.currentCycleMin * 60;
      const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, s.current.remainingSeconds / totalSeconds)) : 0;
      const display: DisplayState = {
        time,
        cycle,
        status,
        progress: progressLabel(),
        task: getCurrentLabel() ? '📌 ' + getCurrentLabel() : '',
        paused: s.current.phase === 'paused',
        fraction,
        isBreak,
      };
      patch({ display });
      pushToPopout(display);
      pushToPiP(display);
    },
    [progressLabel, getCurrentLabel, patch, pushToPopout, pushToPiP]
  );

  const refreshIdleDisplay = useCallback(() => {
    if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
    if (s.current.appMode === 'standard') {
      const st = s.current.startMin;
      syncDisplay(Number.isInteger(st) && st > 0 ? fmt(st * 60) : '00:00', 'Ready', '');
    } else if (s.current.schedule.length) {
      syncDisplay(
        fmt(s.current.schedule[0].min * 60),
        'Ready · ' + s.current.schedule.length + ' cycles scheduled',
        ''
      );
    } else {
      syncDisplay('--:--', 'Build a schedule above', '');
    }
  }, [syncDisplay]);

  // ───────────────────────── DB session lifecycle ─────────────────────────
  const saveSnapshot = useCallback(
    async (resumePoint: 'this_cycle' | 'next_cycle') => {
      if (!userId || !s.current.currentSessionId) return;
      await dbSaveSnapshot(userId, {
        session_id: s.current.currentSessionId,
        snapshot_at: new Date().toISOString(),
        app_mode: s.current.appMode,
        autopilot: s.current.autopilot,
        break_seconds: getBreakSeconds(),
        alert_sound: getAlertSound(),
        start_min: s.current.appMode === 'standard' ? s.current.startMin : null,
        end_min: s.current.appMode === 'standard' ? s.current.endMin : s.current.endMinutes,
        std_task_label: s.current.appMode === 'standard' ? s.current.stdTaskLabel.trim() : null,
        schedule: s.current.appMode === 'target' ? s.current.schedule : null,
        schedule_index: s.current.scheduleIndex,
        current_cycle_min: s.current.currentCycleMin,
        completed_cycles: s.current.completedCyclesCount,
        resume_point: resumePoint,
        remaining_seconds: resumePoint === 'this_cycle' ? s.current.remainingSeconds : null,
        standard_direction: s.current.direction,
        standard_step_min: s.current.stepMin,
      });
    },
    [userId, getBreakSeconds, getAlertSound]
  );

  // ───────────────────────── button state (derived) ─────────────────────────
  const buttonState = useCallback(() => {
    const phase = s.current.phase;
    const st = {
      showStart: true,
      showPause: true,
      showResume: false,
      showContinue: false,
      startDisabled: true,
      pauseDisabled: true,
      resumeDisabled: true,
      stopDisabled: true,
      modeBadge: null as 'auto' | 'manual' | null,
    };
    if (phase === 'idle') {
      st.startDisabled = false;
      st.stopDisabled = true;
    }
    if (phase === 'finished') {
      st.startDisabled = false;
      st.stopDisabled = false;
    }
    if (phase === 'countdown' || phase === 'break') {
      st.pauseDisabled = false;
      st.stopDisabled = false;
      st.modeBadge = s.current.autopilot ? 'auto' : 'manual';
    }
    if (phase === 'announcing-break' || phase === 'announcing-next' || phase === 'reviewing') {
      st.stopDisabled = false;
      st.modeBadge = s.current.autopilot ? 'auto' : 'manual';
    }
    if (phase === 'paused') {
      st.showPause = false;
      st.showResume = true;
      st.resumeDisabled = false;
      st.stopDisabled = false;
      st.modeBadge = s.current.autopilot ? 'auto' : 'manual';
    }
    if (phase === 'waiting') {
      st.showContinue = true;
      st.stopDisabled = false;
      st.modeBadge = s.current.autopilot ? 'auto' : 'manual';
    }
    return st;
  }, []);

  const inputsDisabled = useCallback(
    () => s.current.phase !== 'idle' && s.current.phase !== 'finished',
    []
  );

  // ───────────────────────── engine flow ─────────────────────────
  const finishAll = useCallback(async () => {
    clearTimer();
    runTokenRef.current++;
    cancelSpeech();
    await dbDeleteSnapshot(s.current.currentSessionId || '');
    if (s.current.currentSessionId) {
      await dbEndSession(s.current.currentSessionId, s.current.completedCyclesCount, 'completed');
    }
    clearLockIfOwned();
    patch({ phase: 'finished', currentSessionId: null, currentCycleLogId: null });
    syncDisplay('00:00', '🎉 Finished!', 'All cycles complete.');
  }, [clearTimer, patch, syncDisplay, clearLockIfOwned]);

  const cycleNumber = useCallback(() => {
    if (s.current.appMode === 'target') return s.current.scheduleIndex + 1;
    return s.current.startMin - s.current.currentCycleMin + 1;
  }, []);

  const advanceToNextCycle = useCallback((): boolean => {
    if (s.current.appMode === 'target') {
      const nextIndex = s.current.scheduleIndex + 1;
      if (nextIndex >= s.current.schedule.length) {
        void finishAll();
        return false;
      }
      patch({ scheduleIndex: nextIndex, currentCycleMin: s.current.schedule[nextIndex].min });
    } else {
      const step = s.current.stepMin || 1;
      const nextMin =
        s.current.direction === 'increasing' ? s.current.currentCycleMin + step : s.current.currentCycleMin - step;
      const overshot =
        s.current.direction === 'increasing' ? nextMin > s.current.endMinutes : nextMin < s.current.endMinutes;
      if (overshot) {
        void finishAll();
        return false;
      }
      patch({ currentCycleMin: nextMin });
    }
    return true;
  }, [finishAll, patch]);

  const openReviewModal = useCallback(
    (label: string, cycleNum: number): Promise<{ answer: 'yes' | 'no' | null; note: string }> => {
      if (settingsRef.current?.ask_feedback_after_cycle === false) {
        return Promise.resolve({ answer: null, note: '' });
      }
      return new Promise((resolve) => {
        reviewResolveRef.current = resolve;
        patch({
          reviewModalOpen: true,
          reviewQuestion: `Did you use this time for: "${label || 'Cycle ' + cycleNum}"?`,
        });
      });
    },
    [patch]
  );

  const closeReview = useCallback(
    (answer: 'yes' | 'no' | null, note: string) => {
      patch({ reviewModalOpen: false });
      if (reviewResolveRef.current) {
        reviewResolveRef.current({ answer, note });
        reviewResolveRef.current = null;
      }
    },
    [patch]
  );

  const tickRef = useRef<() => void>(() => {});

  const transitionToBreak = useCallback(
    async (completedNum: number, capturedToken: number) => {
      const sv = () => runTokenRef.current === capturedToken;
      patch({ phase: 'announcing-break' });
      const cycleLabel = `Circle ${completedNum} complete`;
      const timeStr = fmt(s.current.remainingSeconds);
      syncDisplay(timeStr, cycleLabel, '📣 Break starting…');
      await announceBreakStart(getAlertSound(), completedNum, sv, getBreakTransitionSeconds(), (remaining) =>
        syncDisplay(timeStr, cycleLabel, `📣 Break starting in ${remaining}…`)
      );
      if (!sv()) return;

      await saveSnapshot('next_cycle');

      patch({ phase: 'reviewing' });
      const label = getCurrentLabel();
      const { answer, note } = await openReviewModal(label, completedNum);
      if (!sv()) return;
      patch({ completedCyclesCount: s.current.completedCyclesCount + 1 });
      if (s.current.currentCycleLogId) {
        await dbEndCycle(s.current.currentCycleLogId, answer, note, s.current.pausedSecondsInCycle);
      }
      if (!sv()) return;

      const breakSecs = getBreakSeconds();
      patch({ phase: 'break', breakRemaining: breakSecs, remainingSeconds: breakSecs });
      syncDisplay(
        fmt(breakSecs),
        'Break',
        'Break – waiting ' + breakSecs + ' second' + (breakSecs === 1 ? '' : 's')
      );
      clearTimer();
      intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
    },
    [patch, syncDisplay, getAlertSound, saveSnapshot, getCurrentLabel, openReviewModal, getBreakSeconds, clearTimer, getBreakTransitionSeconds]
  );

  const transitionToNextCycle = useCallback(
    async (capturedToken: number) => {
      const hasMore = advanceToNextCycle();
      if (!hasMore) return;
      const nextNum = cycleNumber();
      const sv = () => runTokenRef.current === capturedToken && s.current.phase === 'announcing-next';
      const nextLabel = getCurrentLabel();
      if (userId && s.current.currentSessionId) {
        const logId = await dbStartCycle(
          userId,
          s.current.currentSessionId,
          nextNum,
          s.current.currentCycleMin,
          nextLabel
        );
        patch({ currentCycleLogId: logId, pausedSecondsInCycle: 0, currentCycleExtensions: [], currentCycleRestartCount: 0 });
        if (logId && s.current.pendingBreakPauseReason) {
          const reason = s.current.pendingBreakPauseReason;
          patch({ pendingBreakPauseReason: null });
          try {
            await dbUpdateCycleLog(logId, { break_pause_reason: reason });
          } catch (e) {
            console.warn('Saving break pause reason failed:', e);
          }
        }
      }

      await saveSnapshot('this_cycle');

      const nextTimeStr = fmt(s.current.currentCycleMin * 60);
      const nextCycleLabel = `Cycle ${nextNum} — ${s.current.currentCycleMin} min`;
      syncDisplay(nextTimeStr, nextCycleLabel, '📣 Starting…');
      await announceNextCycleStart(getAlertSound(), nextNum, sv, getTransitionSeconds(), (remaining) =>
        syncDisplay(nextTimeStr, nextCycleLabel, `📣 Starting in ${remaining}…`)
      );
      if (!sv()) return;

      if (s.current.autopilot) {
        const secs = s.current.currentCycleMin * 60;
        patch({ phase: 'countdown', remainingSeconds: secs });
        syncDisplay(fmt(secs), `Cycle: ${s.current.currentCycleMin} min`, '');
        clearTimer();
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      } else {
        clearTimer();
        patch({ phase: 'waiting' });
        syncDisplay(
          fmt(s.current.currentCycleMin * 60),
          `Cycle: ${s.current.currentCycleMin} min – Ready`,
          '🖐 Press Continue to start next countdown'
        );
      }
    },
    [advanceToNextCycle, cycleNumber, getCurrentLabel, userId, patch, saveSnapshot, syncDisplay, getAlertSound, clearTimer, getTransitionSeconds]
  );

  const proceedAfterCycleEnd = useCallback(
    (completedNum: number, isLast: boolean) => {
      if (isLast) {
        patch({ phase: 'announcing-break' });
        const cap = runTokenRef.current;
        const sv = () => runTokenRef.current === cap;
        syncDisplay('00:00', `Circle ${completedNum} complete`, '🎉 All done!');
        // Every cycle is genuinely done at this point — record that now,
        // before the review modal, not after. Previously this only happened
        // in finishAll() at the very end, so refreshing the page while the
        // review modal was still waiting for an answer left the session's
        // DB row at status='active' forever, indistinguishable from a
        // truly-abandoned session even though all the work was finished.
        if (s.current.currentSessionId) {
          void dbEndSession(s.current.currentSessionId, s.current.completedCyclesCount + 1, 'completed');
          void dbDeleteSnapshot(s.current.currentSessionId);
        }
        if (s.current.currentCycleLogId) {
          void dbUpdateCycleLog(s.current.currentCycleLogId, { ended_at: new Date().toISOString() });
        }
        (async () => {
          if (getAlertSound() === 'voice') {
            await speakSequence([`Circle ${completedNum} complete. All circles finished!`], sv);
          } else {
            playBeep();
            await new Promise((r) => setTimeout(r, 800));
          }
          if (!sv()) return;
          patch({ phase: 'reviewing' });
          const label = getCurrentLabel();
          const { answer, note } = await openReviewModal(label, completedNum);
          if (!sv()) return;
          patch({ completedCyclesCount: s.current.completedCyclesCount + 1 });
          if (s.current.currentCycleLogId) {
            await dbEndCycle(s.current.currentCycleLogId, answer, note, s.current.pausedSecondsInCycle);
          }
          if (sv()) await finishAll();
        })();
        return;
      }
      patch({ phase: 'announcing-break' });
      const cap = runTokenRef.current;
      void transitionToBreak(completedNum, cap);
    },
    [patch, syncDisplay, getAlertSound, getCurrentLabel, openReviewModal, finishAll, transitionToBreak]
  );

  const tick = useCallback(() => {
    const phase = s.current.phase;
    if (phase === 'countdown') {
      const remaining = s.current.remainingSeconds > 0 ? s.current.remainingSeconds - 1 : 0;
      patch({ remainingSeconds: remaining });
      syncDisplay(fmt(remaining), `Cycle: ${s.current.currentCycleMin} min`, '');
      const endAlertSecs = settingsRef.current?.end_alert_enabled ? settingsRef.current.end_alert_seconds : 0;
      if (endAlertSecs > 0 && remaining > 0 && remaining <= endAlertSecs) {
        const useLabel = settingsRef.current?.end_alert_use_task_label;
        const label = (useLabel && getCurrentLabel()) || `Cycle ${cycleNumber()}`;
        cueEndingSoon(getAlertSound(), remaining, remaining === endAlertSecs, label);
      }
      if (remaining === 0) {
        const completedNum = cycleNumber();
        const isLast =
          s.current.appMode === 'target'
            ? s.current.scheduleIndex >= s.current.schedule.length - 1
            : s.current.direction === 'increasing'
              ? s.current.currentCycleMin + s.current.stepMin > s.current.endMinutes
              : s.current.currentCycleMin - s.current.stepMin < s.current.endMinutes;
        clearTimer();
        if (s.current.appMode === 'target') {
          // Target mode: offer "I'm done / need more time / restart" right at
          // the moment the buzzer goes off, instead of ambient Extend/Restart
          // buttons sitting there distracting during the whole countdown.
          cycleEndInfoRef.current = { completedNum, isLast };
          syncDisplay('00:00', isLast ? `Circle ${completedNum} complete` : `Cycle ${completedNum} complete`, '');
          patch({ cycleEndChoiceOpen: true });
          return;
        }
        proceedAfterCycleEnd(completedNum, isLast);
      }
      return;
    }
    if (phase === 'break') {
      const breakRemaining = s.current.breakRemaining > 0 ? s.current.breakRemaining - 1 : 0;
      patch({ breakRemaining, remainingSeconds: breakRemaining });
      syncDisplay(
        fmt(breakRemaining),
        'Break',
        'Break – waiting ' + breakRemaining + ' second' + (breakRemaining === 1 ? '' : 's')
      );
      if (breakRemaining === 0) {
        clearTimer();
        patch({ phase: 'announcing-next' });
        const cap = runTokenRef.current;
        void transitionToNextCycle(cap);
      }
    }
  }, [patch, syncDisplay, cycleNumber, clearTimer, getAlertSound, getCurrentLabel, proceedAfterCycleEnd, transitionToNextCycle]);

  tickRef.current = tick;

  const extendCurrentCycleRef = useRef<(minutes: number) => void>(() => {});
  const restartCurrentCycleRef = useRef<() => void>(() => {});

  const resolveCycleEndChoice = useCallback(
    (choice: 'done' | 'extend' | 'restart', extendMinutes?: number) => {
      patch({ cycleEndChoiceOpen: false });
      const info = cycleEndInfoRef.current;
      cycleEndInfoRef.current = null;
      if (choice === 'extend' && extendMinutes && extendMinutes > 0) {
        extendCurrentCycleRef.current(extendMinutes);
        return;
      }
      if (choice === 'restart') {
        restartCurrentCycleRef.current();
        return;
      }
      if (info) proceedAfterCycleEnd(info.completedNum, info.isLast);
    },
    [patch, proceedAfterCycleEnd]
  );

  // ───────────────────────── pause / resume / continue ─────────────────────────
  const pauseTimer = useCallback(() => {
    if (s.current.phase !== 'countdown' && s.current.phase !== 'break') return;
    const before = s.current.phase;
    pauseStartedAtRef.current = Date.now();
    patch({ phaseBeforePause: before, phase: 'paused' });
    clearTimer();
    void saveSnapshot(before === 'countdown' ? 'this_cycle' : 'next_cycle');
    const cycle = before === 'countdown' ? `Cycle: ${s.current.currentCycleMin} min` : 'Break';
    const status =
      before === 'countdown' ? '⏸ Paused' : `⏸ Paused – ${s.current.breakRemaining}s remaining in break`;
    syncDisplay(fmt(s.current.remainingSeconds), cycle, status);
  }, [patch, clearTimer, saveSnapshot, syncDisplay]);

  const performResume = useCallback(
    (elapsedSeconds: number) => {
      const p = s.current.phaseBeforePause as Phase;
      patch({ pausedSecondsInCycle: s.current.pausedSecondsInCycle + elapsedSeconds, phase: p, phaseBeforePause: null });
      pauseStartedAtRef.current = null;
      intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
    },
    [patch]
  );

  const resumeTimer = useCallback(() => {
    if (s.current.phase !== 'paused') return;
    const p = s.current.phaseBeforePause as Phase;
    const elapsed = pauseStartedAtRef.current !== null ? Math.round((Date.now() - pauseStartedAtRef.current) / 1000) : 0;

    const settings = settingsRef.current;
    if (settings?.long_pause_check_enabled) {
      let thresholdSeconds = 0;
      if (p === 'countdown') {
        thresholdSeconds = settings.long_pause_cycle_minutes * 60;
      } else if (p === 'break') {
        const breakSecs = getBreakSeconds();
        thresholdSeconds =
          settings.long_pause_break_mode === 'percent'
            ? Math.round(breakSecs * (1 + settings.long_pause_break_percent / 100))
            : breakSecs + settings.long_pause_break_minutes * 60;
      }
      if (thresholdSeconds > 0 && elapsed > thresholdSeconds) {
        pendingResumeElapsedRef.current = elapsed;
        patch({
          pauseReasonPromptOpen: true,
          pauseReasonContext: p === 'break' ? 'break' : 'cycle',
          pauseReasonAwaySeconds: elapsed,
        });
        return; // stay paused — performResume runs once the modal resolves
      }
    }

    performResume(elapsed);
  }, [patch, performResume, getBreakSeconds]);

  const resolvePauseReason = useCallback(
    async (reason: string) => {
      const context = s.current.pauseReasonContext;
      const elapsed = pendingResumeElapsedRef.current;
      const trimmed = reason.trim();
      patch({ pauseReasonPromptOpen: false, pauseReasonContext: null, pauseReasonAwaySeconds: 0 });

      if (context === 'cycle' && trimmed && s.current.currentCycleLogId) {
        try {
          await dbUpdateCycleLog(s.current.currentCycleLogId, { pause_reason: trimmed });
        } catch (e) {
          console.warn('Saving pause reason failed:', e);
        }
      } else if (context === 'break' && trimmed) {
        patch({ pendingBreakPauseReason: trimmed });
      }

      performResume(elapsed);
    },
    [patch, performResume]
  );

  // ───────────────────────── extend / restart (Target mode) ─────────────────────────
  // Single log entry per work block, always — extensions accumulate as a list
  // (so History can show "20m → +15m → +12m = 47m total") without ever
  // touching duration_min, which stays the original planned length. A restart
  // resets progress and clears extensions (a fresh attempt), but bumps
  // restart_count so the do-over itself stays visible as "Restarted N×".
  const canExtendOrRestart = useCallback(
    () =>
      s.current.appMode === 'target' &&
      (s.current.phase === 'countdown' || (s.current.phase === 'paused' && s.current.phaseBeforePause === 'countdown')),
    []
  );

  const extendCurrentCycle = useCallback(
    async (minutes: number) => {
      if (!canExtendOrRestart() || minutes <= 0) return;
      patch({
        remainingSeconds: s.current.remainingSeconds + minutes * 60,
        currentCycleExtensions: [...s.current.currentCycleExtensions, minutes],
      });
      syncDisplay(
        fmt(s.current.remainingSeconds),
        `Cycle: ${s.current.currentCycleMin} min (+${minutes}m)`,
        s.current.phase === 'paused' ? '⏸ Paused' : ''
      );
      // Covers both resuming-from-pause and the new end-of-cycle "extend"
      // choice, where the interval was already stopped (the cycle had hit 0).
      if (s.current.phase === 'countdown' && intervalRef.current === null) {
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      }
      if (s.current.currentCycleLogId) {
        try {
          await dbAppendCycleExtension(s.current.currentCycleLogId, minutes);
        } catch (e) {
          console.warn('Saving extension failed:', e);
        }
      }
    },
    [canExtendOrRestart, patch, syncDisplay]
  );
  extendCurrentCycleRef.current = extendCurrentCycle;

  const restartCurrentCycle = useCallback(async () => {
    if (!canExtendOrRestart()) return;
    const freshSeconds = s.current.currentCycleMin * 60;
    pauseStartedAtRef.current = null;
    patch({
      remainingSeconds: freshSeconds,
      pausedSecondsInCycle: 0,
      // currentCycleExtensions deliberately NOT cleared — a restart resets
      // progress, not the record of how much time this work block has cost.
      // Extensions made before the restart still count toward the total.
      currentCycleRestartCount: s.current.currentCycleRestartCount + 1,
      phase: 'countdown',
      phaseBeforePause: null,
    });
    syncDisplay(fmt(freshSeconds), `Cycle: ${s.current.currentCycleMin} min`, '🔄 Cycle restarted');
    // Covers resuming-from-pause and the new end-of-cycle "restart" choice.
    if (intervalRef.current === null) {
      clearTimer();
      intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
    }
    if (s.current.currentCycleLogId) {
      try {
        await dbRegisterCycleRestart(s.current.currentCycleLogId);
      } catch (e) {
        console.warn('Saving restart failed:', e);
      }
    }
  }, [canExtendOrRestart, patch, syncDisplay, clearTimer]);
  restartCurrentCycleRef.current = restartCurrentCycle;

  const continueNextCycle = useCallback(() => {
    if (s.current.phase !== 'waiting') return;
    patch({ phase: 'announcing-next' });
    const cap = runTokenRef.current;
    const nextNum = cycleNumber();
    const sv = () => runTokenRef.current === cap && s.current.phase === 'announcing-next';
    const timeStr = fmt(s.current.currentCycleMin * 60);
    const cycleLabel = `Cycle ${nextNum} — ${s.current.currentCycleMin} min`;
    syncDisplay(timeStr, cycleLabel, '📣 Starting…');
    announceNextCycleStart(getAlertSound(), nextNum, sv, getTransitionSeconds(), (remaining) =>
      syncDisplay(timeStr, cycleLabel, `📣 Starting in ${remaining}…`)
    ).then(() => {
      if (!sv()) return;
      const secs = s.current.currentCycleMin * 60;
      patch({ phase: 'countdown', remainingSeconds: secs });
      syncDisplay(fmt(secs), `Cycle: ${s.current.currentCycleMin} min`, '');
      clearTimer();
      intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
    });
  }, [patch, cycleNumber, syncDisplay, getAlertSound, clearTimer, getTransitionSeconds]);

  // ───────────────────────── start / stop ─────────────────────────
  const validateStandard = useCallback((): string | null => {
    const st = s.current.startMin;
    const en = s.current.endMin;
    const step = s.current.stepMin;
    const br = s.current.breakSeconds;
    if (!Number.isInteger(st) || st <= 0) return 'Start time must be a positive integer.';
    if (!Number.isInteger(en) || en <= 0) return 'End time must be a positive integer.';
    if (!Number.isInteger(step) || step < 1) return 'Step must be a positive integer.';
    if (s.current.direction === 'decreasing' && en > st) return 'End time must be ≤ start time when decreasing.';
    if (s.current.direction === 'increasing' && en < st) return 'End time must be ≥ start time when increasing.';
    if (!Number.isInteger(br) || br < 1) return 'Break interval must be ≥ 1 second.';
    return null;
  }, []);

  const validateTarget = useCallback((): string | null => {
    if (!s.current.schedule.length) return 'Build a cycle schedule first.';
    const br = s.current.tBreakSeconds;
    if (!Number.isInteger(br) || br < 1) return 'Break interval must be ≥ 1 second.';
    return null;
  }, []);

  const doStartRef = useRef<(auto: boolean) => void>(() => {});

  const requestStart = useCallback(() => {
    patch({ errorMsg: '' });
    refreshLockStatus();
    if (s.current.lockedByOtherTab) {
      patch({ errorMsg: 'A session is already running in another tab. Finish it there first.' });
      return;
    }
    const err = s.current.appMode === 'standard' ? validateStandard() : validateTarget();
    if (err) {
      patch({ errorMsg: err });
      return;
    }
    const startupMode = settingsRef.current?.startup_mode ?? 'ask';
    if (startupMode === 'autopilot' || startupMode === 'manual') {
      doStartRef.current(startupMode === 'autopilot');
      return;
    }
    patch({ modeModalOpen: true });
  }, [patch, refreshLockStatus, validateStandard, validateTarget]);

  const doStart = useCallback(
    async (auto: boolean) => {
      runTokenRef.current++;
      patch({ autopilot: auto, completedCyclesCount: 0, modeModalOpen: false, pausedSecondsInCycle: 0, currentCycleExtensions: [], currentCycleRestartCount: 0 });

      if (s.current.appMode === 'standard') {
        patch({
          currentCycleMin: s.current.startMin,
          endMinutes: s.current.endMin,
          scheduleIndex: 0,
        });
      } else {
        patch({ scheduleIndex: 0, currentCycleMin: s.current.schedule[0].min, endMinutes: 0 });
      }
      const secs = s.current.currentCycleMin * 60;
      patch({ remainingSeconds: secs });

      if (userId) {
        const sessionId = await dbStartSession(userId, s.current.appMode, auto, s.current.sessionName);
        patch({ currentSessionId: sessionId });
        if (sessionId) {
          writeLock(sessionId);
          const logId = await dbStartCycle(userId, sessionId, 1, s.current.currentCycleMin, getCurrentLabel());
          patch({ currentCycleLogId: logId });
        }
      }
      await saveSnapshot('this_cycle');

      patch({ phase: 'announcing-next' });
      const cap = runTokenRef.current;
      const sv = () => runTokenRef.current === cap && s.current.phase === 'announcing-next';
      const startTimeStr = fmt(secs);
      const startCycleLabel = `Cycle 1 — ${s.current.currentCycleMin} min`;
      syncDisplay(startTimeStr, startCycleLabel, '📣 Starting…');
      announceNextCycleStart(getAlertSound(), 1, sv, getTransitionSeconds(), (remaining) =>
        syncDisplay(startTimeStr, startCycleLabel, `📣 Starting in ${remaining}…`)
      ).then(() => {
        if (!sv()) return;
        patch({ phase: 'countdown' });
        syncDisplay(fmt(s.current.remainingSeconds), `Cycle: ${s.current.currentCycleMin} min`, '');
        clearTimer();
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      });
    },
    [patch, userId, getCurrentLabel, saveSnapshot, syncDisplay, getAlertSound, clearTimer, writeLock, getTransitionSeconds]
  );
  doStartRef.current = doStart;

  const stopAndReset = useCallback(async () => {
    runTokenRef.current++;
    clearTimer();
    pauseStartedAtRef.current = null;
    // 'finished' means the session already completed cleanly (finishAll()
    // already recorded it and cleared these IDs) — Reset here is just "clear
    // the finished screen," never something to abandon. Previously this
    // still ran the abandon logic below, which had one lingering side effect:
    // currentCycleLogId wasn't cleared by finishAll, so clicking Reset after
    // finishing would silently overwrite the already-completed last cycle's
    // log with completed=null/'[abandoned]'.
    const wasActuallyActive = s.current.phase !== 'idle' && s.current.phase !== 'finished';

    if (wasActuallyActive) {
      if (s.current.reviewModalOpen) {
        patch({ reviewModalOpen: false });
        if (reviewResolveRef.current) {
          reviewResolveRef.current({ answer: null, note: '' });
          reviewResolveRef.current = null;
        }
      }
      if (s.current.currentCycleLogId) {
        await dbEndCycle(s.current.currentCycleLogId, null, '[abandoned]', s.current.pausedSecondsInCycle);
      }
      if (s.current.currentSessionId) {
        await dbEndSession(s.current.currentSessionId, s.current.completedCyclesCount, 'interrupted');
      }
      clearLockIfOwned();
      notifyRecoverableChanged();
    }

    cancelSpeech();
    patch({
      phase: 'idle',
      phaseBeforePause: null,
      breakRemaining: 0,
      scheduleIndex: 0,
      completedCyclesCount: 0,
      pausedSecondsInCycle: 0,
      currentCycleExtensions: [],
      currentCycleRestartCount: 0,
      currentCycleLogId: null,
      currentSessionId: null,
      errorMsg: '',
    });
    refreshIdleDisplay();
  }, [clearTimer, patch, refreshIdleDisplay, clearLockIfOwned]);

  // ───────────────────────── resume from snapshot ─────────────────────────
  const checkForInterruptedSession = useCallback(async () => {
    if (!userId) return;
    // A session is genuinely live in this tab (running, paused, mid-transition)
    // — never surface the resume banner over it. 'finished' is safe to check
    // through, though: nothing is at risk of being clobbered once a session
    // has completed, and refusing to check here was why resuming a *different*
    // interrupted session required first clicking Reset.
    if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
    try {
      const found = await dbFindInterruptedSession(s.current.currentSessionId);
      if (!found) {
        patch({ resumeBannerVisible: false });
        return;
      }
      const { session, snapshot } = found;
      const cyclesDone = snapshot.completed_cycles;
      const totalCycles = snapshot.app_mode === 'target' ? (snapshot.schedule || []).length : '?';
      const resumeFrom =
        snapshot.resume_point === 'this_cycle'
          ? `Cycle ${snapshot.schedule_index + 1} (restart from full ${snapshot.current_cycle_min} min)`
          : `Cycle ${snapshot.schedule_index + 1} (next uncompleted)`;
      const date = new Date(session.started_at).toLocaleString();
      patch({
        pendingResume: { session, snapshot },
        resumeBannerSub: `Session from ${date} · ${cyclesDone} of ${totalCycles} cycles done. Will resume: ${resumeFrom}`,
        resumeBannerVisible: true,
      });
    } catch (e) {
      console.warn('Resume check failed:', e);
    }
  }, [userId, patch]);


  const doResume = useCallback(
    async (session: SessionRow, snap: SnapshotRow, choice: 'continue' | 'restart' = 'continue') => {
      runTokenRef.current++;
      writeLock(session.id);
      patch({
        completedCyclesCount: snap.completed_cycles,
        currentSessionId: session.id,
        sessionName: session.name || '',
        autopilot: snap.autopilot,
        appMode: snap.app_mode,
      });

      if (snap.app_mode === 'target') {
        const schedule = (snap.schedule || []).map((c) => ({ min: c.min, label: c.label || '' }));
        patch({
          schedule,
          tBreakSeconds: snap.break_seconds,
          subMode: 'manual',
        });
      } else {
        patch({
          startMin: snap.start_min || 30,
          endMin: snap.end_min || 10,
          breakSeconds: snap.break_seconds,
          stdTaskLabel: snap.std_task_label || '',
          direction: snap.standard_direction || 'decreasing',
          stepMin: snap.standard_step_min || 1,
        });
      }

      let scheduleIndex = snap.schedule_index;
      let currentCycleMin = snap.current_cycle_min;
      let endMinutes = snap.end_min || 0;
      let startSeconds: number | null = null;

      if (snap.resume_point === 'this_cycle') {
        // Paused mid-cycle: 'continue' picks up from the exact second it was
        // paused at; 'restart' replays this same cycle from its full length.
        if (choice === 'continue' && typeof snap.remaining_seconds === 'number') {
          startSeconds = snap.remaining_seconds;
        }
        // choice === 'restart' (or no exact time recorded): fall through and
        // use the full currentCycleMin duration below — same cycle either way.
      } else if (snap.app_mode === 'target') {
        // Previous cycle at scheduleIndex was already completed.
        if (choice === 'restart') {
          // Redo that same completed cycle from the beginning.
          currentCycleMin = (snap.schedule || [])[scheduleIndex]?.min ?? currentCycleMin;
        } else {
          // Advance to the next cycle — this was previously the bug: the
          // index never moved, silently re-running the completed cycle.
          const nextIndex = scheduleIndex + 1;
          if (nextIndex >= (snap.schedule || []).length) {
            await finishAll();
            return;
          }
          scheduleIndex = nextIndex;
          currentCycleMin = (snap.schedule || [])[nextIndex].min;
        }
      } else {
        // Standard mode, previous cycle completed.
        if (choice === 'restart') {
          // Redo the same completed cycle length as-is (currentCycleMin unchanged).
        } else {
          const step = snap.standard_step_min || 1;
          const direction = snap.standard_direction || 'decreasing';
          const nextMin = direction === 'increasing' ? snap.current_cycle_min + step : snap.current_cycle_min - step;
          const overshot = direction === 'increasing' ? nextMin > endMinutes : nextMin < endMinutes;
          if (overshot) {
            await finishAll();
            return;
          }
          currentCycleMin = nextMin;
        }
      }

      patch({ scheduleIndex, currentCycleMin, endMinutes, phase: 'announcing-next', pausedSecondsInCycle: 0, currentCycleExtensions: [], currentCycleRestartCount: 0 });
      const secs = startSeconds ?? currentCycleMin * 60;
      patch({ remainingSeconds: secs });

      if (userId) {
        const logId = await dbStartCycle(
          userId,
          session.id,
          scheduleIndex + 1,
          currentCycleMin,
          getCurrentLabel()
        );
        patch({ currentCycleLogId: logId });
      }

      const cap = runTokenRef.current;
      const cycleNum =
        snap.app_mode === 'target' ? scheduleIndex + 1 : (snap.start_min || 30) - currentCycleMin + 1;
      const sv = () => runTokenRef.current === cap && s.current.phase === 'announcing-next';

      const resumeTimeStr = fmt(secs);
      const resumeCycleLabel = `Cycle ${cycleNum} — ${currentCycleMin} min (resuming)`;
      syncDisplay(resumeTimeStr, resumeCycleLabel, '📣 Resuming…');

      announceNextCycleStart(getAlertSound(), cycleNum, sv, getTransitionSeconds(), (remaining) =>
        syncDisplay(resumeTimeStr, resumeCycleLabel, `📣 Resuming in ${remaining}…`)
      ).then(() => {
        if (!sv()) return;
        patch({ phase: 'countdown' });
        syncDisplay(fmt(s.current.remainingSeconds), `Cycle: ${currentCycleMin} min`, '');
        clearTimer();
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      });
    },
    [patch, userId, getCurrentLabel, syncDisplay, getAlertSound, clearTimer, finishAll, writeLock, getTransitionSeconds]
  );

  const resumeSession = useCallback(async () => {
    if (!s.current.pendingResume) return;
    const { session, snapshot } = s.current.pendingResume;
    patch({ resumeBannerVisible: false });
    await doResume(session, snapshot);
    patch({ pendingResume: null });
  }, [patch, doResume]);

  const dismissResume = useCallback(async () => {
    patch({ resumeBannerVisible: false });
    if (s.current.pendingResume) {
      await dbAbandonSession(s.current.pendingResume.session.id);
      patch({ pendingResume: null });
    }
  }, [patch]);

  // ───────────────────────── mode / tab switching ─────────────────────────
  const setAppMode = useCallback(
    (mode: AppMode) => {
      // A running or paused session must never be silently reset just because
      // the person clicked the Standard/Target tab — that was overwriting a
      // live countdown with "--:--". Switching mode is only meaningful (and
      // only allowed) when there's nothing in progress to lose.
      if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
      patch({ appMode: mode, schedule: [] });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  const setSubMode = useCallback(
    (mode: SubMode) => {
      if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
      patch({ subMode: mode, schedule: [] });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  // ───────────────────────── schedule builders ─────────────────────────
  const generateAutoSchedule = useCallback(() => {
    const target = s.current.acTarget;
    const start = s.current.acStart;
    const step = s.current.acStep;
    if (!Number.isInteger(target) || target < 1) {
      patch({ autoHint: '⚠ Target must be positive.' });
      return;
    }
    if (!Number.isInteger(start) || start < 1) {
      patch({ autoHint: '⚠ Start must be positive.' });
      return;
    }
    if (!Number.isInteger(step) || step < 1) {
      patch({ autoHint: '⚠ Step must be positive.' });
      return;
    }
    if (start > target) {
      patch({ autoHint: '⚠ Start cannot exceed target.' });
      return;
    }
    const raw: number[] = [];
    let cur = start;
    let sum = 0;
    while (cur >= 1 && sum < target) {
      const add = Math.min(cur, target - sum);
      raw.push(add);
      sum += add;
      cur = Math.max(1, cur - step);
      if (sum >= target) break;
      if (raw.length > 2000) break;
    }
    if (sum < target) {
      const def = target - sum;
      for (let i = 0; i < def; i++) raw.push(1);
    }
    const schedule = raw.map((m) => ({ min: m, label: '' }));
    patch({
      schedule,
      autoHint: `✅ ${schedule.length} cycles — total ${schedule.reduce((a, b) => a + b.min, 0)} min.`,
    });
    refreshIdleDisplay();
  }, [patch, refreshIdleDisplay]);

  const addManualCycle = useCallback(() => {
    const v = s.current.manualAddValue;
    if (!Number.isInteger(v) || v < 1) {
      patch({ errorMsg: 'Enter a positive integer.' });
      return;
    }
    patch({ errorMsg: '', schedule: [...s.current.schedule, { min: v, label: '' }] });
    refreshIdleDisplay();
  }, [patch, refreshIdleDisplay]);

  const updateCycleMin = useCallback(
    (idx: number, v: number) => {
      const schedule = [...s.current.schedule];
      schedule[idx] = { ...schedule[idx], min: v };
      patch({ schedule });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  const updateCycleLabel = useCallback(
    (idx: number, label: string) => {
      const schedule = [...s.current.schedule];
      schedule[idx] = { ...schedule[idx], label };
      patch({ schedule });
    },
    [patch]
  );

  const removeCycle = useCallback(
    (idx: number) => {
      const schedule = [...s.current.schedule];
      schedule.splice(idx, 1);
      patch({ schedule });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  const moveCycle = useCallback(
    (idx: number, direction: 'up' | 'down') => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= s.current.schedule.length) return;
      const schedule = [...s.current.schedule];
      [schedule[idx], schedule[targetIdx]] = [schedule[targetIdx], schedule[idx]];
      patch({ schedule });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  const loadScheduleFromTemplate = useCallback(
    (tpl: TemplateRow) => {
      const schedule = (tpl.schedule || []).map((c) => ({ min: c.min, label: c.label || '' }));
      patch({
        schedule,
        tBreakSeconds: tpl.break_seconds || 10,
        subMode: 'manual',
        errorMsg: '',
      });
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  // Pre-fill the Timer config (without starting) from a stale/interrupted
  // session's last snapshot — used by the "Restart" action on the Recover page.
  const configureFromSnapshot = useCallback(
    (snap: SnapshotRow, sessionName?: string | null) => {
      if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
      if (snap.app_mode === 'target') {
        const schedule = (snap.schedule || []).map((c) => ({ min: c.min, label: c.label || '' }));
        patch({
          appMode: 'target',
          schedule,
          tBreakSeconds: snap.break_seconds,
          tAlertSound: snap.alert_sound,
          subMode: 'manual',
          sessionName: sessionName || '',
          errorMsg: '',
        });
      } else {
        patch({
          appMode: 'standard',
          startMin: snap.start_min || 30,
          endMin: snap.end_min || 10,
          breakSeconds: snap.break_seconds,
          alertSound: snap.alert_sound,
          stdTaskLabel: snap.std_task_label || '',
          direction: snap.standard_direction || 'decreasing',
          stepMin: snap.standard_step_min || 1,
          sessionName: sessionName || '',
          errorMsg: '',
        });
      }
      refreshIdleDisplay();
    },
    [patch, refreshIdleDisplay]
  );

  // ───────────────────────── popout / PiP ─────────────────────────
  const widgetFontLink =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">';

  const widgetBaseCSS = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif;
      background:#14181C;color:#EEF1EE;display:flex;flex-direction:column;
      align-items:center;justify-content:center;min-height:100vh;padding:18px;text-align:center;
      -webkit-user-select:none;user-select:none;
    }
    #pw-brand{
      display:flex;align-items:center;gap:6px;font-family:'Space Grotesk',sans-serif;font-weight:700;
      font-size:.78rem;color:#9BA3A8;letter-spacing:.3px;margin-bottom:14px;
    }
    #pw-brand .pw-dot{width:6px;height:6px;border-radius:50%;background:#3B8A81;}
  `;

  // ── Ring: the original design — progress ring with time centered inside ──
  const widgetCSSRing = widgetBaseCSS + `
    #pw-card{
      width:100%;max-width:280px;background:#2A2E32;border:1px solid rgba(255,255,255,.07);
      border-radius:18px;padding:20px 18px 18px;display:flex;flex-direction:column;align-items:center;
    }
    #pw-ring-wrap{position:relative;width:132px;height:132px;margin-bottom:12px;}
    #pw-ring-wrap svg{transform:rotate(-90deg);width:100%;height:100%;}
    #pw-ring-track{fill:none;stroke:rgba(255,255,255,.07);stroke-width:8;}
    #pw-ring-fill{
      fill:none;stroke:#3B8A81;stroke-width:8;stroke-linecap:round;
      stroke-dasharray:${PW_RING_C};stroke-dashoffset:0;
      transition:stroke-dashoffset .9s linear,stroke .3s ease;
    }
    #pw-ring-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
    #pw-time{
      font-family:'IBM Plex Mono',monospace;font-size:1.7rem;font-weight:600;letter-spacing:.5px;
      font-variant-numeric:tabular-nums;color:#EEF1EE;transition:color .3s;
    }
    #pw-cycle{font-size:.86rem;font-weight:600;color:#C7CCC9;margin-bottom:3px;min-height:1.3em;}
    #pw-task{font-size:.74rem;color:#6FBFB2;margin-bottom:3px;min-height:1.15em;font-weight:500;}
    #pw-status{font-size:.72rem;color:#E8A23D;min-height:1.3em;}
    #pw-prog{font-size:.62rem;color:#9BA3A8;margin-top:4px;min-height:1.1em;font-family:'IBM Plex Mono',monospace;}
    #pw-card[data-paused="1"] #pw-time{color:#E8A23D;}
  `;
  const widgetBodyHTMLRing = (d: DisplayState) => `<div id="pw-card">
      <div id="pw-brand"><span class="pw-dot"></span>FocusFlow</div>
      <div id="pw-ring-wrap">
        <svg viewBox="0 0 120 120">
          <circle id="pw-ring-track" cx="60" cy="60" r="${PW_RING_R}"></circle>
          <circle id="pw-ring-fill" cx="60" cy="60" r="${PW_RING_R}"></circle>
        </svg>
        <div id="pw-ring-center"><div id="pw-time">${d.time}</div></div>
      </div>
      <div id="pw-cycle">${d.cycle}</div>
      <div id="pw-task">${d.task}</div>
      <div id="pw-status">${d.status}</div>
      <div id="pw-prog">${d.progress}</div>
    </div>`;

  // ── Minimal: just the timer, nothing else — as distraction-free as possible ──
  const widgetCSSMinimal = widgetBaseCSS + `
    #pw-card{ width:100%; display:flex; flex-direction:column; align-items:center; }
    #pw-time{
      font-family:'IBM Plex Mono',monospace;font-size:3.4rem;font-weight:600;letter-spacing:1px;
      font-variant-numeric:tabular-nums;color:#EEF1EE;transition:color .3s;
    }
    #pw-cycle{font-size:.82rem;color:#9BA3A8;margin-top:10px;min-height:1.2em;}
    #pw-card[data-paused="1"] #pw-time{color:#E8A23D;}
  `;
  const widgetBodyHTMLMinimal = (d: DisplayState) => `<div id="pw-card">
      <div id="pw-time">${d.time}</div>
      <div id="pw-cycle">${d.cycle}</div>
    </div>`;

  // ── Bar: a linear progress bar instead of a ring, more data visible at once ──
  const widgetCSSBar = widgetBaseCSS + `
    #pw-card{
      width:100%;max-width:280px;background:#2A2E32;border:1px solid rgba(255,255,255,.07);
      border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;align-items:stretch;
      text-align:left;
    }
    #pw-cycle{font-size:.82rem;font-weight:600;color:#C7CCC9;margin-bottom:6px;min-height:1.2em;}
    #pw-time{
      font-family:'IBM Plex Mono',monospace;font-size:2.15rem;font-weight:600;letter-spacing:.5px;
      font-variant-numeric:tabular-nums;color:#EEF1EE;margin-bottom:12px;transition:color .3s;
    }
    #pw-bar-track{width:100%;height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:10px;}
    #pw-bar-fill{height:100%;width:0%;border-radius:6px;background:#3B8A81;transition:width .9s linear,background .3s ease;}
    #pw-task{font-size:.74rem;color:#6FBFB2;margin-bottom:2px;min-height:1.1em;font-weight:500;}
    #pw-status{font-size:.7rem;color:#E8A23D;min-height:1.2em;}
    #pw-card[data-paused="1"] #pw-time{color:#E8A23D;}
  `;
  const widgetBodyHTMLBar = (d: DisplayState) => `<div id="pw-card">
      <div id="pw-brand"><span class="pw-dot"></span>FocusFlow</div>
      <div id="pw-cycle">${d.cycle}</div>
      <div id="pw-time">${d.time}</div>
      <div id="pw-bar-track"><div id="pw-bar-fill"></div></div>
      <div id="pw-task">${d.task}</div>
      <div id="pw-status">${d.status}</div>
    </div>`;

  const getWidgetTemplate = useCallback(() => {
    const style = settingsRef.current?.popup_style ?? 'ring';
    if (style === 'minimal') {
      return { css: widgetCSSMinimal, bodyHTML: widgetBodyHTMLMinimal, width: 260, height: 170 };
    }
    if (style === 'bar') {
      return { css: widgetCSSBar, bodyHTML: widgetBodyHTMLBar, width: 300, height: 230 };
    }
    return { css: widgetCSSRing, bodyHTML: widgetBodyHTMLRing, width: 320, height: 400 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openWindowPopout = useCallback(() => {
    if (popWinRef.current && !popWinRef.current.closed) {
      popWinRef.current.focus();
      return;
    }
    const { css, bodyHTML, width, height } = getWidgetTemplate();
    const w = window.open(
      '',
      'FocusFlowPopout',
      `width=${width},height=${height},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );
    if (!w) {
      patch({ errorMsg: 'Pop-out blocked. Please allow pop-ups for this page.' });
      return;
    }
    popWinRef.current = w;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FocusFlow · Live</title>${widgetFontLink}<style>${css}</style></head><body>${bodyHTML(s.current.display)}</body></html>`
    );
    w.document.close();
    applyWidgetState(w.document, s.current.display);
    const iv = setInterval(() => {
      if (!popWinRef.current || popWinRef.current.closed) {
        clearInterval(iv);
        popWinRef.current = null;
      }
    }, 500);
  }, [patch, applyWidgetState, getWidgetTemplate]);

  const openDocumentPiP = useCallback(async () => {
    if (pipWinRef.current) {
      try {
        pipWinRef.current.focus();
        return;
      } catch {
        /* fallthrough */
      }
    }
    try {
      const { css, bodyHTML, width, height } = getWidgetTemplate();
      const pipWin = await (window as any).documentPictureInPicture.requestWindow({ width, height });
      pipWinRef.current = pipWin;
      const fontLinkContainer = pipWin.document.createElement('div');
      fontLinkContainer.innerHTML = widgetFontLink;
      Array.from(fontLinkContainer.children).forEach((el) => pipWin.document.head.appendChild(el));
      const st = pipWin.document.createElement('style');
      st.textContent = css;
      pipWin.document.head.appendChild(st);
      const container = pipWin.document.createElement('div');
      container.innerHTML = bodyHTML(s.current.display);
      pipWin.document.body.appendChild(container);
      pipContainerRef.current = container;
      applyWidgetState(container, s.current.display);
      pipWin.addEventListener('pagehide', () => {
        pipWinRef.current = null;
        pipContainerRef.current = null;
      });
    } catch (err: any) {
      pipWinRef.current = null;
      pipContainerRef.current = null;
      if (err?.name !== 'NotAllowedError') openWindowPopout();
    }
  }, [openWindowPopout, applyWidgetState, getWidgetTemplate]);


  const hasPiP = 'documentPictureInPicture' in window;
  const openPopout = useCallback(() => {
    if (hasPiP) void openDocumentPiP();
    else openWindowPopout();
  }, [hasPiP, openDocumentPiP, openWindowPopout]);

  // Check the lock on mount, and whenever another tab writes/clears it
  // (the 'storage' event only fires in *other* tabs, which is exactly what
  // we want here — each tab reacts to everyone else's changes).
  useEffect(() => {
    refreshLockStatus();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCK_KEY) refreshLockStatus();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep breakSeconds/tBreakSeconds/alertSound in sync with the person's saved
  // defaults — on initial load AND every time they change them in Settings,
  // not just once. Only while idle/finished, so it never touches a live or
  // paused session. Tracked per-field so changing one setting (e.g. theme)
  // doesn't stomp a break length you'd already manually tweaked for this
  // not-yet-started session.
  const lastAppliedSettingsRef = useRef<{
    breakStd: number;
    breakTgt: number;
    alert: AlertSound;
  } | null>(null);
  useEffect(() => {
    if (!settings) return;
    if (s.current.phase !== 'idle' && s.current.phase !== 'finished') return;
    const prev = lastAppliedSettingsRef.current;
    const patchObj: Partial<EngineState> = {};
    if (!prev || prev.breakStd !== settings.default_break_seconds_standard) {
      patchObj.breakSeconds = settings.default_break_seconds_standard;
    }
    if (!prev || prev.breakTgt !== settings.default_break_seconds_target) {
      patchObj.tBreakSeconds = settings.default_break_seconds_target;
    }
    if (!prev || prev.alert !== settings.default_alert_sound) {
      patchObj.alertSound = settings.default_alert_sound;
      patchObj.tAlertSound = settings.default_alert_sound;
    }
    lastAppliedSettingsRef.current = {
      breakStd: settings.default_break_seconds_standard,
      breakTgt: settings.default_break_seconds_target,
      alert: settings.default_alert_sound,
    };
    if (Object.keys(patchObj).length) patch(patchObj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  return {
    state: s.current,
    actions: {
      patch,
      setAppMode,
      setSubMode,
      generateAutoSchedule,
      addManualCycle,
      updateCycleMin,
      updateCycleLabel,
      removeCycle,
      moveCycle,
      loadScheduleFromTemplate,
      configureFromSnapshot,
      requestStart,
      doStart,
      stopAndReset,
      pauseTimer,
      resumeTimer,
      resolvePauseReason,
      extendCurrentCycle,
      restartCurrentCycle,
      resolveCycleEndChoice,
      continueNextCycle,
      checkForInterruptedSession,
      resumeSession,
      doResume,
      dismissResume,
      closeReview,
      refreshIdleDisplay,
      openPopout,
    },
    derived: {
      buttonState: buttonState(),
      inputsDisabled: inputsDisabled(),
      hasPiP,
      canExtendOrRestart: canExtendOrRestart(),
    },
  };
}
