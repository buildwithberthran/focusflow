import { RotateCcw, ArrowRight } from 'lucide-react';
import { useTimerEngine } from '../../context/TimerEngineContext';
import type { Page } from '../Layout/AppShell';

export default function ResumeBanner({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { state } = useTimerEngine();
  if (!state.resumeBannerVisible || !state.pendingResume) return null;

  const { session, snapshot } = state.pendingResume;
  const done = snapshot.completed_cycles;
  const total = snapshot.app_mode === 'target' ? (snapshot.schedule || []).length : null;
  const label = session.name || (total ? `${session.mode} session` : `${session.mode} session`);

  return (
    <button className="resume-strip" onClick={() => onNavigate('recover')}>
      <RotateCcw size={14} strokeWidth={2.2} />
      <span className="resume-strip-text">
        <strong>{label}</strong> interrupted — {done}{total ? ` of ${total}` : ''} cycle{done === 1 ? '' : 's'} done
      </span>
      <span className="resume-strip-link">
        Recover <ArrowRight size={12} strokeWidth={2.4} />
      </span>
    </button>
  );
}
