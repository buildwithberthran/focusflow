import { useCallback, useRef, useState } from 'react';
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
} from '../types';
import {
  announceBreakStart,
  announceNextCycleStart,
  cancelSpeech,
  playBeep,
  speakSequence,
} from '../lib/audio';
import {
  dbAbandonSession,
  dbDeleteSnapshot,
  dbEndCycle,
  dbEndSession,
  dbFindInterruptedSession,
  dbSaveSnapshot,
  dbStartCycle,
  dbStartSession,
} from '../lib/db';

export interface EngineState {
  // config
  appMode: AppMode;
  subMode: SubMode;
  schedule: CycleItem[];

  startMin: number;
  endMin: number;
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
  errorMsg: string;
  display: DisplayState;

  // modals
  modeModalOpen: boolean;
  reviewModalOpen: boolean;
  reviewQuestion: string;
  tplNameModalOpen: boolean;

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

    startMin: 30,
    endMin: 10,
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
    errorMsg: '',
    display: { time: '30:00', cycle: 'Ready', status: '', progress: '', task: '', paused: false },

    modeModalOpen: false,
    reviewModalOpen: false,
    reviewQuestion: '',
    tplNameModalOpen: false,

    resumeBannerVisible: false,
    resumeBannerSub: '',
    pendingResume: null,
  };
}

function fmt(s: number): string {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function useFocusTimer(userId: string | null) {
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
  const reviewResolveRef = useRef<((v: { answer: 'yes' | 'no' | null; note: string }) => void) | null>(
    null
  );
  const popWinRef = useRef<Window | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

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

  const pushToPopout = useCallback((d: DisplayState) => {
    const w = popWinRef.current;
    if (!w || w.closed) return;
    try {
      const doc = w.document;
      (doc.getElementById('pw-time') as HTMLElement).textContent = d.time;
      (doc.getElementById('pw-cycle') as HTMLElement).textContent = d.cycle;
      (doc.getElementById('pw-status') as HTMLElement).textContent = d.status;
      (doc.getElementById('pw-prog') as HTMLElement).textContent = d.progress || '';
      (doc.getElementById('pw-task') as HTMLElement).textContent = d.task || '';
      (doc.getElementById('pw-time') as HTMLElement).style.color = d.paused ? '#ffd166' : '#fff';
    } catch {
      /* ignore */
    }
  }, []);

  const pushToPiP = useCallback((d: DisplayState) => {
    const c = pipContainerRef.current;
    if (!c) return;
    try {
      (c.querySelector('#pw-time') as HTMLElement).textContent = d.time;
      (c.querySelector('#pw-cycle') as HTMLElement).textContent = d.cycle;
      (c.querySelector('#pw-status') as HTMLElement).textContent = d.status;
      (c.querySelector('#pw-prog') as HTMLElement).textContent = d.progress || '';
      (c.querySelector('#pw-task') as HTMLElement).textContent = d.task || '';
      (c.querySelector('#pw-time') as HTMLElement).style.color = d.paused ? '#ffd166' : '#fff';
    } catch {
      /* ignore */
    }
  }, []);

  const syncDisplay = useCallback(
    (time: string, cycle: string, status: string) => {
      const display: DisplayState = {
        time,
        cycle,
        status,
        progress: progressLabel(),
        task: getCurrentLabel() ? '📌 ' + getCurrentLabel() : '',
        paused: s.current.phase === 'paused',
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
    patch({ phase: 'finished', currentSessionId: null });
    syncDisplay('00:00', '🎉 Finished!', 'All cycles complete.');
  }, [clearTimer, patch, syncDisplay]);

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
      const nextMin = s.current.currentCycleMin - 1;
      if (nextMin < s.current.endMinutes) {
        void finishAll();
        return false;
      }
      patch({ currentCycleMin: nextMin });
    }
    return true;
  }, [finishAll, patch]);

  const openReviewModal = useCallback(
    (label: string, cycleNum: number): Promise<{ answer: 'yes' | 'no' | null; note: string }> => {
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
      syncDisplay(fmt(s.current.remainingSeconds), `Circle ${completedNum} complete`, '📣 Break starting in 3…');
      await announceBreakStart(getAlertSound(), completedNum, sv);
      if (!sv()) return;

      await saveSnapshot('next_cycle');

      patch({ phase: 'reviewing' });
      const label = getCurrentLabel();
      const { answer, note } = await openReviewModal(label, completedNum);
      if (!sv()) return;
      patch({ completedCyclesCount: s.current.completedCyclesCount + 1 });
      if (s.current.currentCycleLogId) await dbEndCycle(s.current.currentCycleLogId, answer, note);
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
    [patch, syncDisplay, getAlertSound, saveSnapshot, getCurrentLabel, openReviewModal, getBreakSeconds, clearTimer]
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
        patch({ currentCycleLogId: logId });
      }

      await saveSnapshot('this_cycle');

      syncDisplay(
        fmt(s.current.currentCycleMin * 60),
        `Cycle ${nextNum} — ${s.current.currentCycleMin} min`,
        '📣 Starting in 3…'
      );
      await announceNextCycleStart(getAlertSound(), nextNum, sv);
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
    [advanceToNextCycle, cycleNumber, getCurrentLabel, userId, patch, saveSnapshot, syncDisplay, getAlertSound, clearTimer]
  );

  const tick = useCallback(() => {
    const phase = s.current.phase;
    if (phase === 'countdown') {
      const remaining = s.current.remainingSeconds > 0 ? s.current.remainingSeconds - 1 : 0;
      patch({ remainingSeconds: remaining });
      syncDisplay(fmt(remaining), `Cycle: ${s.current.currentCycleMin} min`, '');
      if (remaining === 0) {
        const completedNum = cycleNumber();
        const isLast =
          s.current.appMode === 'target'
            ? s.current.scheduleIndex >= s.current.schedule.length - 1
            : s.current.currentCycleMin <= s.current.endMinutes;
        clearTimer();
        if (isLast) {
          patch({ phase: 'announcing-break' });
          const cap = runTokenRef.current;
          const sv = () => runTokenRef.current === cap;
          syncDisplay('00:00', `Circle ${completedNum} complete`, '🎉 All done!');
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
            if (s.current.currentCycleLogId) await dbEndCycle(s.current.currentCycleLogId, answer, note);
            if (sv()) await finishAll();
          })();
          return;
        }
        patch({ phase: 'announcing-break' });
        const cap = runTokenRef.current;
        void transitionToBreak(completedNum, cap);
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
  }, [patch, syncDisplay, cycleNumber, clearTimer, getAlertSound, getCurrentLabel, openReviewModal, finishAll, transitionToBreak, transitionToNextCycle]);

  tickRef.current = tick;

  // ───────────────────────── pause / resume / continue ─────────────────────────
  const pauseTimer = useCallback(() => {
    if (s.current.phase !== 'countdown' && s.current.phase !== 'break') return;
    const before = s.current.phase;
    patch({ phaseBeforePause: before, phase: 'paused' });
    clearTimer();
    void saveSnapshot(before === 'countdown' ? 'this_cycle' : 'next_cycle');
    const cycle = before === 'countdown' ? `Cycle: ${s.current.currentCycleMin} min` : 'Break';
    const status =
      before === 'countdown' ? '⏸ Paused' : `⏸ Paused – ${s.current.breakRemaining}s remaining in break`;
    syncDisplay(fmt(s.current.remainingSeconds), cycle, status);
  }, [patch, clearTimer, saveSnapshot, syncDisplay]);

  const resumeTimer = useCallback(() => {
    if (s.current.phase !== 'paused') return;
    const p = s.current.phaseBeforePause as Phase;
    patch({ phase: p, phaseBeforePause: null });
    intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
  }, [patch]);

  const continueNextCycle = useCallback(() => {
    if (s.current.phase !== 'waiting') return;
    patch({ phase: 'announcing-next' });
    const cap = runTokenRef.current;
    const nextNum = cycleNumber();
    const sv = () => runTokenRef.current === cap && s.current.phase === 'announcing-next';
    syncDisplay(
      fmt(s.current.currentCycleMin * 60),
      `Cycle ${nextNum} — ${s.current.currentCycleMin} min`,
      '📣 Starting in 3…'
    );
    announceNextCycleStart(getAlertSound(), nextNum, sv).then(() => {
      if (!sv()) return;
      const secs = s.current.currentCycleMin * 60;
      patch({ phase: 'countdown', remainingSeconds: secs });
      syncDisplay(fmt(secs), `Cycle: ${s.current.currentCycleMin} min`, '');
      clearTimer();
      intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
    });
  }, [patch, cycleNumber, syncDisplay, getAlertSound, clearTimer]);

  // ───────────────────────── start / stop ─────────────────────────
  const validateStandard = useCallback((): string | null => {
    const st = s.current.startMin;
    const en = s.current.endMin;
    const br = s.current.breakSeconds;
    if (!Number.isInteger(st) || st <= 0) return 'Start time must be a positive integer.';
    if (!Number.isInteger(en) || en <= 0) return 'End time must be a positive integer.';
    if (en > st) return 'End time must be ≤ start time.';
    if (!Number.isInteger(br) || br < 1) return 'Break interval must be ≥ 1 second.';
    return null;
  }, []);

  const validateTarget = useCallback((): string | null => {
    if (!s.current.schedule.length) return 'Build a cycle schedule first.';
    const br = s.current.tBreakSeconds;
    if (!Number.isInteger(br) || br < 1) return 'Break interval must be ≥ 1 second.';
    return null;
  }, []);

  const requestStart = useCallback(() => {
    patch({ errorMsg: '' });
    const err = s.current.appMode === 'standard' ? validateStandard() : validateTarget();
    if (err) {
      patch({ errorMsg: err });
      return;
    }
    patch({ modeModalOpen: true });
  }, [patch, validateStandard, validateTarget]);

  const doStart = useCallback(
    async (auto: boolean) => {
      runTokenRef.current++;
      patch({ autopilot: auto, completedCyclesCount: 0, modeModalOpen: false });

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
        const sessionId = await dbStartSession(userId, s.current.appMode, auto);
        patch({ currentSessionId: sessionId });
        if (sessionId) {
          const logId = await dbStartCycle(userId, sessionId, 1, s.current.currentCycleMin, getCurrentLabel());
          patch({ currentCycleLogId: logId });
        }
      }
      await saveSnapshot('this_cycle');

      patch({ phase: 'announcing-next' });
      const cap = runTokenRef.current;
      const sv = () => runTokenRef.current === cap && s.current.phase === 'announcing-next';
      syncDisplay(fmt(secs), `Cycle 1 — ${s.current.currentCycleMin} min`, '📣 Starting in 3…');
      announceNextCycleStart(getAlertSound(), 1, sv).then(() => {
        if (!sv()) return;
        patch({ phase: 'countdown' });
        syncDisplay(fmt(s.current.remainingSeconds), `Cycle: ${s.current.currentCycleMin} min`, '');
        clearTimer();
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      });
    },
    [patch, userId, getCurrentLabel, saveSnapshot, syncDisplay, getAlertSound, clearTimer]
  );

  const stopAndReset = useCallback(async () => {
    runTokenRef.current++;
    clearTimer();
    if (s.current.reviewModalOpen) {
      patch({ reviewModalOpen: false });
      if (reviewResolveRef.current) {
        reviewResolveRef.current({ answer: null, note: '' });
        reviewResolveRef.current = null;
      }
    }
    if (s.current.currentCycleLogId) await dbEndCycle(s.current.currentCycleLogId, null, '[abandoned]');
    if (s.current.currentSessionId) {
      await dbEndSession(s.current.currentSessionId, s.current.completedCyclesCount, 'interrupted');
    }
    cancelSpeech();
    patch({
      phase: 'idle',
      phaseBeforePause: null,
      breakRemaining: 0,
      scheduleIndex: 0,
      completedCyclesCount: 0,
      currentCycleLogId: null,
      currentSessionId: null,
      errorMsg: '',
    });
    refreshIdleDisplay();
  }, [clearTimer, patch, refreshIdleDisplay]);

  // ───────────────────────── resume from snapshot ─────────────────────────
  const checkForInterruptedSession = useCallback(async () => {
    if (!userId) return;
    try {
      const found = await dbFindInterruptedSession();
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
    async (session: SessionRow, snap: SnapshotRow) => {
      runTokenRef.current++;
      patch({
        completedCyclesCount: snap.completed_cycles,
        currentSessionId: session.id,
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
        });
      }

      let scheduleIndex = snap.schedule_index;
      let currentCycleMin = snap.current_cycle_min;
      let endMinutes = snap.end_min || 0;

      if (snap.resume_point === 'this_cycle') {
        // restart the interrupted cycle at its full duration (already correct)
      } else if (snap.app_mode === 'target') {
        if (scheduleIndex >= (snap.schedule || []).length) {
          await finishAll();
          return;
        }
        currentCycleMin = (snap.schedule || [])[scheduleIndex].min;
      } else {
        currentCycleMin = snap.current_cycle_min - 1;
        if (currentCycleMin < endMinutes) {
          await finishAll();
          return;
        }
      }

      patch({ scheduleIndex, currentCycleMin, endMinutes, phase: 'announcing-next' });
      const secs = currentCycleMin * 60;
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

      syncDisplay(fmt(secs), `Cycle ${cycleNum} — ${currentCycleMin} min (resuming)`, '📣 Resuming in 3…');

      announceNextCycleStart(getAlertSound(), cycleNum, sv).then(() => {
        if (!sv()) return;
        patch({ phase: 'countdown' });
        syncDisplay(fmt(s.current.remainingSeconds), `Cycle: ${currentCycleMin} min`, '');
        clearTimer();
        intervalRef.current = window.setInterval(() => tickRef.current(), 1000);
      });
    },
    [patch, userId, getCurrentLabel, syncDisplay, getAlertSound, clearTimer, finishAll]
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
      if (s.current.phase !== 'idle' && s.current.phase !== 'finished') void stopAndReset();
      patch({ appMode: mode, schedule: [] });
      refreshIdleDisplay();
    },
    [patch, stopAndReset, refreshIdleDisplay]
  );

  const setSubMode = useCallback(
    (mode: SubMode) => {
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

  // ───────────────────────── popout / PiP ─────────────────────────
  const widgetCSS = `*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#1e2530;color:#f0f0f0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:14px;text-align:center;}#pw-time{font-size:3.2rem;font-weight:700;letter-spacing:3px;font-variant-numeric:tabular-nums;color:#fff;line-height:1;transition:color 0.3s;}#pw-cycle{font-size:.9rem;color:#8fb6ff;margin-top:10px;min-height:1.4em;}#pw-task{font-size:.78rem;color:#7dffc0;margin-top:4px;min-height:1.2em;font-weight:600;}#pw-status{font-size:.82rem;color:#ffd166;margin-top:5px;min-height:1.4em;}#pw-prog{font-size:.65rem;color:#5a6a88;margin-top:4px;min-height:1.1em;}#pw-label{font-size:.6rem;color:#4a566b;margin-top:12px;letter-spacing:1px;text-transform:uppercase;}`;
  const widgetBodyHTML = useCallback(() => {
    const d = s.current.display;
    return `<div id="pw-time">${d.time}</div><div id="pw-cycle">${d.cycle}</div><div id="pw-task">${d.task}</div><div id="pw-status">${d.status}</div><div id="pw-prog">${d.progress}</div><div id="pw-label">FocusFlow · Live</div>`;
  }, []);

  const openWindowPopout = useCallback(() => {
    if (popWinRef.current && !popWinRef.current.closed) {
      popWinRef.current.focus();
      return;
    }
    const w = window.open(
      '',
      'FocusFlowPopout',
      'width=300,height=290,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no'
    );
    if (!w) {
      patch({ errorMsg: 'Pop-out blocked. Please allow pop-ups for this page.' });
      return;
    }
    popWinRef.current = w;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FocusFlow · Live</title><style>${widgetCSS}</style></head><body>${widgetBodyHTML()}</body></html>`
    );
    w.document.close();
    const iv = setInterval(() => {
      if (!popWinRef.current || popWinRef.current.closed) {
        clearInterval(iv);
        popWinRef.current = null;
      }
    }, 500);
  }, [patch, widgetBodyHTML]);

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
      const pipWin = await (window as any).documentPictureInPicture.requestWindow({
        width: 300,
        height: 290,
      });
      pipWinRef.current = pipWin;
      const st = pipWin.document.createElement('style');
      st.textContent = widgetCSS;
      pipWin.document.head.appendChild(st);
      const container = pipWin.document.createElement('div');
      container.innerHTML = widgetBodyHTML();
      pipWin.document.body.appendChild(container);
      pipContainerRef.current = container;
      pipWin.addEventListener('pagehide', () => {
        pipWinRef.current = null;
        pipContainerRef.current = null;
      });
    } catch (err: any) {
      pipWinRef.current = null;
      pipContainerRef.current = null;
      if (err?.name !== 'NotAllowedError') openWindowPopout();
    }
  }, [openWindowPopout, widgetBodyHTML]);

  const hasPiP = 'documentPictureInPicture' in window;
  const openPopout = useCallback(() => {
    if (hasPiP) void openDocumentPiP();
    else openWindowPopout();
  }, [hasPiP, openDocumentPiP, openWindowPopout]);

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
      loadScheduleFromTemplate,
      requestStart,
      doStart,
      stopAndReset,
      pauseTimer,
      resumeTimer,
      continueNextCycle,
      checkForInterruptedSession,
      resumeSession,
      dismissResume,
      closeReview,
      refreshIdleDisplay,
      openPopout,
    },
    derived: {
      buttonState: buttonState(),
      inputsDisabled: inputsDisabled(),
      hasPiP,
    },
  };
}
