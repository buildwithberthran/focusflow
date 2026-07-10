import type { SnapshotRow } from '../types';
import { formatClock } from './time';

export interface ResumeChoiceDescription {
  hasRealChoice: boolean; // false = only one sensible action, skip the modal
  title: string;
  continueLabel: string;
  restartLabel: string;
}

export function describeResumeChoice(snap: SnapshotRow): ResumeChoiceDescription {
  if (snap.resume_point === 'this_cycle') {
    const hasExact = typeof snap.remaining_seconds === 'number' && snap.remaining_seconds > 0;
    const fullSeconds = snap.current_cycle_min * 60;
    const meaningfullyPartial = hasExact && (snap.remaining_seconds as number) < fullSeconds;
    return {
      hasRealChoice: meaningfullyPartial,
      title: 'This cycle was in progress',
      continueLabel: meaningfullyPartial
        ? `Continue from ${formatClock(snap.remaining_seconds as number)} left`
        : `Continue (${snap.current_cycle_min} min)`,
      restartLabel: `Restart this cycle (${snap.current_cycle_min} min)`,
    };
  }

  // resume_point === 'next_cycle': the previous cycle already completed.
  const cycleNum = snap.schedule_index + 1;
  let hasNext = true;
  if (snap.app_mode === 'target') {
    hasNext = snap.schedule_index + 1 < (snap.schedule || []).length;
  } else {
    hasNext = snap.current_cycle_min - 1 >= (snap.end_min ?? 0);
  }

  return {
    hasRealChoice: true,
    title: `Cycle ${cycleNum} was already completed`,
    continueLabel: hasNext ? `Move to cycle ${cycleNum + 1}` : 'Finish session',
    restartLabel: `Redo cycle ${cycleNum}`,
  };
}
